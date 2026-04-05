import threading
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from data.store import store
import pipeline as pipeline_module

router = APIRouter()


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    if store.state == "processing":
        raise HTTPException(status_code=409, detail="Processing already in progress")

    file_bytes_list = []
    for f in files:
        if not f.filename.endswith(".json"):
            raise HTTPException(status_code=400, detail=f"Only JSON files are accepted, got: {f.filename}")
        content = await f.read()
        file_bytes_list.append(content)

    if not file_bytes_list:
        raise HTTPException(status_code=400, detail="No files provided")

    thread = threading.Thread(target=pipeline_module.run_pipeline, args=(file_bytes_list,), daemon=True)
    thread.start()
    return {"status": "processing"}


@router.get("/status")
def get_status():
    return {
        "state": store.state,
        "progress_pct": store.progress_pct,
        "records_loaded": store.records_loaded,
        "error": store.error,
    }
