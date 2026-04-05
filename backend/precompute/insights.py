"""
20 complex pre-computed insight metrics.
Each returns a dict with: id, name, description, value, unit, data (list for ranked/series).
"""
import math
import pandas as pd
import numpy as np
from itertools import groupby as itertools_groupby


def _tracks(df):
    return df[df["content_type"] == "track"].copy()


# ── 1. Intentional Start Rate ────────────────────────────────────────────────
def intentional_start_rate(df):
    t = _tracks(df)
    rate = t["reason_start"].isin(["clickrow", "playbtn"]).mean()
    by_artist = (
        t.groupby("master_metadata_album_artist_name")
        .apply(lambda g: g["reason_start"].isin(["clickrow", "playbtn"]).mean())
        .rename("intentional_rate")
        .sort_values(ascending=False)
        .reset_index()
    )
    by_artist.columns = ["artist", "intentional_rate"]
    by_artist["intentional_rate"] = by_artist["intentional_rate"].round(3)
    return {
        "id": "intentional_start_rate",
        "name": "Intentional Start Rate",
        "description": "% of plays you deliberately started (clicked or pressed play) vs. auto-played",
        "value": round(float(rate) * 100, 1),
        "unit": "%",
        "data": by_artist.head(20).to_dict(orient="records"),
        "data_label": "Top artists by intentional rate",
    }


# ── 2. Skip Velocity ─────────────────────────────────────────────────────────
def skip_velocity(df):
    t = _tracks(df)
    skipped = t[t["is_skipped"]]
    global_ms = float(skipped["ms_played"].mean()) if not skipped.empty else 0
    by_artist = (
        skipped.groupby("master_metadata_album_artist_name")["ms_played"]
        .agg(["mean", "count"])
        .query("count >= 5")
        .sort_values("mean")
        .reset_index()
    )
    by_artist.columns = ["artist", "avg_ms_before_skip", "skip_count"]
    by_artist["avg_ms_before_skip"] = by_artist["avg_ms_before_skip"].round(0).astype(int)
    return {
        "id": "skip_velocity",
        "name": "Skip Velocity",
        "description": "Avg milliseconds listened before skipping — lower = you reject songs faster",
        "value": round(global_ms / 1000, 1),
        "unit": "s before skip",
        "data": by_artist.head(20).to_dict(orient="records"),
        "data_label": "Artists you skip fastest (min 5 skips)",
    }


# ── 3. Obsession Windows ──────────────────────────────────────────────────────
def obsession_windows(df):
    t = _tracks(df)
    t["date"] = t["ts"].dt.date
    daily_artist = t.groupby(["date", "master_metadata_album_artist_name"])["ms_played"].sum().reset_index()
    daily_total = t.groupby("date")["ms_played"].sum().rename("total")
    daily_artist = daily_artist.join(daily_total, on="date")
    daily_artist["share"] = daily_artist["ms_played"] / daily_artist["total"]

    results = []
    for artist, grp in daily_artist.groupby("master_metadata_album_artist_name"):
        grp = grp.set_index("date").sort_index()
        grp.index = pd.to_datetime(grp.index)
        rolling = grp["share"].rolling("7D").max()
        peak = rolling.max()
        if peak >= 0.5:
            peak_date = rolling.idxmax()
            results.append({"artist": artist, "peak_share_pct": round(peak * 100, 1), "peak_date": str(peak_date.date())})

    results.sort(key=lambda x: x["peak_share_pct"], reverse=True)
    return {
        "id": "obsession_windows",
        "name": "Obsession Windows",
        "description": "7-day periods where one artist was >50% of your listening — your hyperfixation cycles",
        "value": len(results),
        "unit": "obsession phases detected",
        "data": results[:20],
        "data_label": "Artists by peak 7-day share",
    }


# ── 4. Session Opener Artists ─────────────────────────────────────────────────
def session_opener_artists(df):
    t = _tracks(df)
    first_plays = t.sort_values("ts").groupby("session_id").first().reset_index()
    counts = (
        first_plays["master_metadata_album_artist_name"]
        .value_counts()
        .reset_index()
    )
    counts.columns = ["artist", "session_opener_count"]
    total = len(first_plays)
    counts["pct"] = (counts["session_opener_count"] / total * 100).round(1)
    return {
        "id": "session_opener_artists",
        "name": "Session Opener Artists",
        "description": "Artists you most often choose as the very first song when starting a listening session",
        "value": counts.iloc[0]["artist"] if not counts.empty else "—",
        "unit": "top opener",
        "data": counts.head(20).to_dict(orient="records"),
        "data_label": "Artists by session opener count",
    }


# ── 5. Rediscoveries ──────────────────────────────────────────────────────────
def rediscoveries(df):
    t = _tracks(df).sort_values("ts")
    t["prev_ts"] = t.groupby("spotify_track_uri")["ts"].shift(1)
    t["gap_days"] = (t["ts"] - t["prev_ts"]).dt.days
    red = (
        t[t["gap_days"] > 180]
        .groupby(["spotify_track_uri", "master_metadata_track_name", "master_metadata_album_artist_name"])
        .agg(max_gap_days=("gap_days", "max"), rediscovery_count=("gap_days", "count"))
        .reset_index()
        .sort_values("max_gap_days", ascending=False)
    )
    red.columns = ["uri", "track", "artist", "max_gap_days", "rediscovery_count"]
    return {
        "id": "rediscoveries",
        "name": "Rediscoveries",
        "description": "Tracks you returned to after 180+ day gaps — songs that pulled you back from the past",
        "value": int(len(red)),
        "unit": "tracks rediscovered",
        "data": red.head(20).to_dict(orient="records"),
        "data_label": "Biggest gap before return (days)",
    }


# ── 6. Artist Graduation ──────────────────────────────────────────────────────
def artist_graduation(df):
    t = _tracks(df).sort_values("ts")
    first_enc = t.groupby("master_metadata_album_artist_name").first().reset_index()
    shuffle_intro = set(first_enc[first_enc["reason_start"] == "shuffle"]["master_metadata_album_artist_name"])
    intentional = t[t["reason_start"].isin(["clickrow", "playbtn"])]
    intentional_artists = set(intentional["master_metadata_album_artist_name"].unique())
    graduated = shuffle_intro & intentional_artists

    grad_counts = (
        intentional[intentional["master_metadata_album_artist_name"].isin(graduated)]
        .groupby("master_metadata_album_artist_name")
        .size()
        .sort_values(ascending=False)
        .reset_index()
    )
    grad_counts.columns = ["artist", "intentional_plays_after_shuffle"]
    return {
        "id": "artist_graduation",
        "name": "Artist Graduation",
        "description": "Artists you first heard on shuffle but later began actively seeking out",
        "value": len(graduated),
        "unit": "shuffle → intentional artists",
        "data": grad_counts.head(20).to_dict(orient="records"),
        "data_label": "Intentional plays after shuffle discovery",
    }


# ── 7. Binge Depth ────────────────────────────────────────────────────────────
def binge_depth(df):
    t = _tracks(df).sort_values(["session_id", "ts"])

    def max_run(grp):
        artists = grp["master_metadata_album_artist_name"].tolist()
        best_artist, best_len, cur_artist, cur_len = None, 0, None, 0
        for a in artists:
            if a == cur_artist:
                cur_len += 1
            else:
                cur_artist, cur_len = a, 1
            if cur_len > best_len:
                best_len, best_artist = cur_len, cur_artist
        return pd.Series({"artist": best_artist, "run_length": best_len,
                          "session_start": grp["ts"].min().isoformat()})

    binges = t.groupby("session_id").apply(max_run).reset_index()
    binges = binges[binges["run_length"] >= 3].sort_values("run_length", ascending=False)
    return {
        "id": "binge_depth",
        "name": "Binge Depth",
        "description": "Longest consecutive runs of the same artist in a single session — your deepest rabbit holes",
        "value": int(binges["run_length"].max()) if not binges.empty else 0,
        "unit": "max consecutive plays",
        "data": binges.head(20).to_dict(orient="records"),
        "data_label": "Longest same-artist run per session",
    }


# ── 8. Cold Drops ─────────────────────────────────────────────────────────────
def cold_drops(df):
    t = _tracks(df)
    last_played = t.groupby("master_metadata_album_artist_name")["ts"].max()
    play_counts = t.groupby("master_metadata_album_artist_name").size().rename("total_plays")
    cutoff = t["ts"].max() - pd.Timedelta(days=365)
    cold = (
        last_played[last_played < cutoff]
        .reset_index()
        .merge(play_counts.reset_index(), on="master_metadata_album_artist_name")
        .query("total_plays >= 10")
        .sort_values("ts")
    )
    cold.columns = ["artist", "last_played", "total_plays"]
    cold["last_played"] = cold["last_played"].dt.date.astype(str)
    cold["days_since"] = (pd.Timestamp.now(tz="UTC").tz_localize(None) -
                          pd.to_datetime(cold["last_played"])).dt.days
    return {
        "id": "cold_drops",
        "name": "Cold Drops",
        "description": "Artists you used to listen to (10+ plays) but haven't touched in over a year",
        "value": int(len(cold)),
        "unit": "abandoned artists",
        "data": cold.head(30).to_dict(orient="records"),
        "data_label": "Artists by last play date (oldest first)",
    }


# ── 9. Weekend Skew ───────────────────────────────────────────────────────────
def weekend_skew(df):
    t = _tracks(df).copy()
    t["is_weekend"] = t["dow"].isin([5, 6])
    total_wk = t[~t["is_weekend"]]["ms_played_valid"].sum()
    total_we = t[t["is_weekend"]]["ms_played_valid"].sum()
    if total_wk + total_we == 0:
        baseline = 0.5
    else:
        baseline = total_we / (total_wk + total_we)

    by_artist = t.groupby(["master_metadata_album_artist_name", "is_weekend"])["ms_played_valid"].sum().unstack(fill_value=0)
    by_artist.columns = ["weekday_ms", "weekend_ms"]
    by_artist["total_ms"] = by_artist.sum(axis=1)
    by_artist = by_artist[by_artist["total_ms"] >= 600_000]
    by_artist["weekend_share"] = by_artist["weekend_ms"] / by_artist["total_ms"]
    by_artist["skew"] = (by_artist["weekend_share"] - baseline).round(3)
    result = by_artist["skew"].sort_values(ascending=False).reset_index()
    result.columns = ["artist", "weekend_skew"]

    return {
        "id": "weekend_skew",
        "name": "Weekend Skew",
        "description": "Artists you listen to disproportionately on weekends vs weekdays",
        "value": round(float(baseline) * 100, 1),
        "unit": "% baseline weekend listening",
        "data": result.head(20).to_dict(orient="records"),
        "data_label": "Weekend skew score (positive = weekend-heavy)",
    }


# ── 10. Late Night Affinity ───────────────────────────────────────────────────
def late_night_affinity(df):
    t = _tracks(df)
    late = t[t["hour_utc"].isin([0, 1, 2, 3])]
    baseline = len(late) / len(t) if len(t) else 0
    late_share = late.groupby("master_metadata_album_artist_name")["ms_played_valid"].sum()
    total_share = t.groupby("master_metadata_album_artist_name")["ms_played_valid"].sum()
    affinity = (late_share / total_share).dropna()
    affinity = affinity[total_share >= 300_000]
    score = (affinity - baseline).sort_values(ascending=False).reset_index()
    score.columns = ["artist", "late_night_score"]
    score["late_night_score"] = score["late_night_score"].round(3)
    return {
        "id": "late_night_affinity",
        "name": "Late Night Affinity",
        "description": "Artists disproportionately played between midnight–4am compared to your overall pattern",
        "value": round(float(baseline) * 100, 1),
        "unit": "% of plays are late night (baseline)",
        "data": score.head(20).to_dict(orient="records"),
        "data_label": "Late night affinity score",
    }


# ── 11. Track Loyalty Score ───────────────────────────────────────────────────
def track_loyalty(df):
    t = _tracks(df).copy()
    t["completed"] = t["reason_end"] == "trackdone"
    loyalty = (
        t.groupby(["spotify_track_uri", "master_metadata_track_name", "master_metadata_album_artist_name"])
        .agg(total_plays=("completed", "count"), completions=("completed", "sum"))
        .query("total_plays >= 5")
        .reset_index()
    )
    loyalty["loyalty_score"] = (loyalty["completions"] / loyalty["total_plays"]).round(3)
    loyalty = loyalty.sort_values("loyalty_score", ascending=False)
    loyalty.columns = ["uri", "track", "artist", "total_plays", "completions", "loyalty_score"]
    return {
        "id": "track_loyalty",
        "name": "Track Loyalty Score",
        "description": "Tracks you always listen to all the way through — measured by full completion rate",
        "value": round(float(loyalty["loyalty_score"].mean()) * 100, 1) if not loyalty.empty else 0,
        "unit": "% avg completion rate",
        "data": loyalty.head(20).to_dict(orient="records"),
        "data_label": "Tracks by full-completion rate (min 5 plays)",
    }


# ── 12. Platform Switching Friction ──────────────────────────────────────────
def platform_switching(df):
    t = _tracks(df).sort_values("ts")
    sessions = t.groupby("session_id").agg(
        start_platform=("platform_family", "first"),
        end_platform=("platform_family", "last"),
    ).reset_index()
    sessions["switched"] = sessions["start_platform"] != sessions["end_platform"]
    switch_rate = float(sessions["switched"].mean())
    matrix = pd.crosstab(sessions["start_platform"], sessions["end_platform"], normalize="index")
    matrix_records = matrix.reset_index().melt(id_vars="start_platform").rename(
        columns={"start_platform": "from", "platform_family": "to", "value": "rate"}
    )
    matrix_records["rate"] = matrix_records["rate"].round(3)
    return {
        "id": "platform_switching",
        "name": "Platform Switching Friction",
        "description": "How often a listening session spans more than one device or platform",
        "value": round(switch_rate * 100, 1),
        "unit": "% sessions cross-platform",
        "data": matrix_records.to_dict(orient="records"),
        "data_label": "Platform transition matrix",
    }


# ── 13. Shuffle Escape Rate ───────────────────────────────────────────────────
def shuffle_escape_rate(df):
    t = _tracks(df).sort_values(["session_id", "ts"])
    shuffle_sessions = t[t["shuffle"].fillna(False)]["session_id"].unique()
    shuffle_df = t[t["session_id"].isin(shuffle_sessions)]

    def has_escape(grp):
        if not grp["shuffle"].iloc[0]:
            return False
        return grp["reason_start"].isin(["clickrow", "playbtn", "backbtn"]).any()

    rate = shuffle_df.groupby("session_id").apply(has_escape).mean()
    return {
        "id": "shuffle_escape_rate",
        "name": "Shuffle Escape Rate",
        "description": "How often you override shuffle mid-session by manually picking a track — when shuffle wasn't good enough",
        "value": round(float(rate) * 100, 1),
        "unit": "% of shuffle sessions escaped",
        "data": [],
        "data_label": "",
    }


# ── 14. Album Completionism ───────────────────────────────────────────────────
def album_completionism(df):
    t = _tracks(df)
    tracks_heard = t.groupby("master_metadata_album_album_name")["spotify_track_uri"].nunique().rename("tracks_heard")
    artist_map = t.drop_duplicates("master_metadata_album_album_name").set_index(
        "master_metadata_album_album_name"
    )["master_metadata_album_artist_name"]
    album_total = tracks_heard  # total unique tracks heard per album is our denominator proxy
    # For albums with >= 6 unique tracks heard, score = 1.0 (we can only measure what we heard)
    # Better: compare to a "catalog size" proxy = tracks in our data for that album
    catalog_size = t.groupby("master_metadata_album_album_name")["spotify_track_uri"].nunique()
    result = pd.DataFrame({
        "tracks_heard": tracks_heard,
        "catalog_proxy": catalog_size,
        "artist": artist_map,
    }).query("catalog_proxy >= 5").copy()
    result["completionism_pct"] = (result["tracks_heard"] / result["catalog_proxy"] * 100).round(1)
    result = result.sort_values("completionism_pct", ascending=False).reset_index()
    result.columns = ["album", "tracks_heard", "total_tracks", "artist", "completionism_pct"]
    return {
        "id": "album_completionism",
        "name": "Album Completionism",
        "description": "Albums where you've heard every (or nearly every) track — are you an album listener?",
        "value": int((result["completionism_pct"] == 100).sum()),
        "unit": "fully explored albums",
        "data": result.head(20).to_dict(orient="records"),
        "data_label": "Albums by % of tracks heard (min 5 tracks)",
    }


# ── 15. Sonic Patience Index ──────────────────────────────────────────────────
def sonic_patience(df):
    t = _tracks(df)
    track_max = t.groupby("spotify_track_uri")["ms_played"].max().rename("approx_duration")
    skipped = t[t["is_skipped"]].join(track_max, on="spotify_track_uri")
    skipped = skipped[skipped["approx_duration"] > 0].copy()
    skipped["patience_pct"] = (skipped["ms_played"] / skipped["approx_duration"]).clip(0, 1)
    global_patience = float(skipped["patience_pct"].mean())
    by_artist = (
        skipped.groupby("master_metadata_album_artist_name")["patience_pct"]
        .agg(["mean", "count"])
        .query("count >= 5")
        .sort_values("mean")
        .reset_index()
    )
    by_artist.columns = ["artist", "avg_patience_pct", "skip_count"]
    by_artist["avg_patience_pct"] = (by_artist["avg_patience_pct"] * 100).round(1)
    return {
        "id": "sonic_patience",
        "name": "Sonic Patience Index",
        "description": "How far into a track you listen before skipping — measures how much of a chance you give a song",
        "value": round(global_patience * 100, 1),
        "unit": "% of track heard before skip (avg)",
        "data": by_artist.head(20).to_dict(orient="records"),
        "data_label": "Artists you give least patience to (min 5 skips)",
    }


# ── 16. Instant Replay Rate ───────────────────────────────────────────────────
def instant_replay(df):
    t = _tracks(df).sort_values(["session_id", "ts"]).reset_index(drop=True)
    t["prev_uri"] = t.groupby("session_id")["spotify_track_uri"].shift(1)
    t["prev_end"] = t.groupby("session_id")["reason_end"].shift(1)
    replays = t[
        (t["spotify_track_uri"] == t["prev_uri"]) & (t["prev_end"] == "trackdone")
    ]
    counts = (
        replays.groupby(["spotify_track_uri", "master_metadata_track_name", "master_metadata_album_artist_name"])
        .size()
        .reset_index(name="instant_replays")
        .sort_values("instant_replays", ascending=False)
    )
    counts.columns = ["uri", "track", "artist", "instant_replays"]
    return {
        "id": "instant_replay",
        "name": "Instant Replay",
        "description": "Tracks you replayed immediately after they finished — songs you couldn't let go of",
        "value": int(len(replays)),
        "unit": "total instant replays",
        "data": counts.head(20).to_dict(orient="records"),
        "data_label": "Most instantly-replayed tracks",
    }


# ── 17. Session Shape ──────────────────────────────────────────────────────────
def session_shape(df):
    t = _tracks(df).sort_values(["session_id", "ts"])

    def classify(grp):
        plays = grp["ms_played"].values
        if len(plays) < 3:
            return "micro"
        mid = len(plays) // 2
        first_avg = plays[:mid].mean()
        second_avg = plays[mid:].mean()
        cv = plays.std() / (plays.mean() + 1)
        if cv > 0.8:
            return "chaotic"
        if second_avg > first_avg * 1.2:
            return "warmup"
        if first_avg > second_avg * 1.2:
            return "cooldown"
        return "steady"

    shapes = t.groupby("session_id").apply(classify).value_counts(normalize=True).round(3)
    shapes_dict = shapes.to_dict()
    data = [{"shape": k, "pct": round(v * 100, 1)} for k, v in shapes_dict.items()]
    dominant = max(shapes_dict, key=shapes_dict.get)
    return {
        "id": "session_shape",
        "name": "Session Shape",
        "description": "How your listening sessions arc: warmup (longer songs later), cooldown, chaotic, or steady",
        "value": dominant,
        "unit": "dominant session arc",
        "data": data,
        "data_label": "Session arc distribution",
    }


# ── 18. Artist Discovery Velocity ────────────────────────────────────────────
def discovery_velocity(df):
    t = _tracks(df)
    t["ts_dt"] = t["ts"]
    first_hear = t.groupby("master_metadata_album_artist_name")["ts_dt"].min().rename("first_heard")
    by_month = (
        first_hear.dt.tz_localize(None)
        .dt.to_period("M")
        .value_counts()
        .sort_index()
        .reset_index()
    )
    by_month.columns = ["yearmonth", "new_artists"]
    by_month["yearmonth"] = by_month["yearmonth"].astype(str)
    by_month["rolling_avg"] = by_month["new_artists"].rolling(3, min_periods=1).mean().round(1)
    return {
        "id": "discovery_velocity",
        "name": "Artist Discovery Velocity",
        "description": "New artists introduced to your rotation each month — is your musical world expanding or contracting?",
        "value": round(float(by_month["new_artists"].mean()), 1),
        "unit": "avg new artists/month",
        "data": by_month.to_dict(orient="records"),
        "data_label": "New artists discovered per month",
    }


# ── 19. Context Collapse Tracks ───────────────────────────────────────────────
def context_collapse(df):
    t = _tracks(df)

    def entropy(series):
        p = series.value_counts(normalize=True)
        return float(-(p * p.apply(lambda x: math.log2(x) if x > 0 else 0)).sum())

    play_counts = t.groupby("spotify_track_uri").size().rename("plays")
    qualified = play_counts[play_counts >= 8].index

    sub = t[t["spotify_track_uri"].isin(qualified)]
    hour_ent = sub.groupby("spotify_track_uri")["hour_utc"].apply(entropy).rename("hour_entropy")
    dow_ent = sub.groupby("spotify_track_uri")["dow"].apply(entropy).rename("dow_entropy")
    meta = t.drop_duplicates("spotify_track_uri").set_index("spotify_track_uri")[
        ["master_metadata_track_name", "master_metadata_album_artist_name"]
    ]

    result = pd.concat([hour_ent, dow_ent, play_counts], axis=1).join(meta).dropna()
    result["collapse_score"] = (result["hour_entropy"] + result["dow_entropy"]).round(3)
    result = result.sort_values("collapse_score", ascending=False).reset_index()
    result.columns = ["uri", "hour_entropy", "dow_entropy", "plays", "track", "artist", "collapse_score"]
    return {
        "id": "context_collapse",
        "name": "Context Collapse Tracks",
        "description": "Tracks with no particular time or mood association — your genuinely all-weather music",
        "value": len(result),
        "unit": "context-free tracks",
        "data": result.head(20).to_dict(orient="records"),
        "data_label": "Tracks played across the widest variety of times",
    }


# ── 20. Comfort Gravity Score ─────────────────────────────────────────────────
def comfort_gravity(df):
    t = _tracks(df)
    passive = ["trackdone", "appload"]
    by_artist = (
        t.groupby("master_metadata_album_artist_name")
        .apply(lambda g: pd.Series({
            "total_plays": len(g),
            "passive_plays": g["reason_start"].isin(passive).sum(),
        }))
        .query("total_plays >= 15")
        .reset_index()
    )
    by_artist["comfort_score"] = (by_artist["passive_plays"] / by_artist["total_plays"]).round(3)
    by_artist.columns = ["artist", "total_plays", "passive_plays", "comfort_score"]

    high = by_artist.nlargest(10, "comfort_score").to_dict(orient="records")
    low = by_artist.nsmallest(10, "comfort_score").to_dict(orient="records")
    return {
        "id": "comfort_gravity",
        "name": "Comfort Gravity Score",
        "description": "Artists you drift to passively (high score) vs. deliberately seek out (low score) — your musical comfort blankets",
        "value": round(float(by_artist["comfort_score"].mean()) * 100, 1),
        "unit": "% avg passive start rate",
        "data": {"passive_comfort": high, "active_pursuit": low},
        "data_label": "High = you drift into them; Low = you actively choose them",
    }


# ── Master runner ─────────────────────────────────────────────────────────────
ALL_METRICS = [
    intentional_start_rate,
    skip_velocity,
    obsession_windows,
    session_opener_artists,
    rediscoveries,
    artist_graduation,
    binge_depth,
    cold_drops,
    weekend_skew,
    late_night_affinity,
    track_loyalty,
    platform_switching,
    shuffle_escape_rate,
    album_completionism,
    sonic_patience,
    instant_replay,
    session_shape,
    discovery_velocity,
    context_collapse,
    comfort_gravity,
]


def compute_all_insights(df):
    results = {}
    for fn in ALL_METRICS:
        try:
            r = fn(df)
            results[r["id"]] = r
        except Exception as e:
            results[fn.__name__] = {"id": fn.__name__, "name": fn.__name__, "error": str(e), "data": []}
    return results
