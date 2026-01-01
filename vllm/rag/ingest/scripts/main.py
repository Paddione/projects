import os
import time
import shutil
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    StorageContext,
    Settings
)
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.embeddings import BaseEmbedding
from llama_index.llms.openai import OpenAI
import requests
from typing import List
from qdrant_client import QdrantClient

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
INBOX_DIR = "/app/inbox"
PROCESSED_DIR = "/app/processed"
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
EMBEDDING_API_URL = os.getenv("EMBEDDING_API_URL", "http://infinity:7997")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
LLM_API_URL = os.getenv("LLM_API_URL", "http://vllm:8888/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "vllm-model")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-dummy")

class InfinityEmbedding(BaseEmbedding):
    model_name: str
    base_url: str

    def __init__(self, model_name: str, base_url: str, **kwargs):
        super().__init__(model_name=model_name, base_url=base_url, **kwargs)

    @classmethod
    def class_name(cls) -> str:
        return "InfinityEmbedding"

    def _get_query_embedding(self, query: str) -> List[float]:
        return self._get_text_embedding(query)

    def _get_text_embedding(self, text: str) -> List[float]:
        response = requests.post(
            f"{self.base_url}/embeddings",
            json={"input": [text], "model": self.model_name}
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        response = requests.post(
            f"{self.base_url}/embeddings",
            json={"input": texts, "model": self.model_name}
        )
        response.raise_for_status()
        return [item["embedding"] for item in response.json()["data"]]

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._get_text_embedding(text)

# Initialize LlamaIndex Settings
Settings.embed_model = InfinityEmbedding(
    model_name=EMBEDDING_MODEL,
    base_url=EMBEDDING_API_URL
)
Settings.llm = OpenAI(
    model=LLM_MODEL,
    api_base=LLM_API_URL,
    api_key=LLM_API_KEY
)

def get_category(file_path: Path) -> str:
    ext = file_path.suffix.lower()
    if ext in ['.pdf']: return 'PDF'
    if ext in ['.md', '.txt', '.html', '.htm']: return 'Documents'
    if ext in ['.py', '.js', '.ts', '.go', '.cpp', '.h', '.java', '.yaml', '.yml']: return 'Code'
    return 'Other'

class FileHandler(FileSystemEventHandler):
    def __init__(self, client: QdrantClient, vector_store: QdrantVectorStore):
        self.client = client
        self.vector_store = vector_store
        self.storage_context = StorageContext.from_defaults(vector_store=vector_store)

    def on_created(self, event):
        if not event.is_directory:
            self.process_file(Path(event.src_path))

    def process_file(self, file_path: Path):
        # Wait a bit for file to be fully written
        time.sleep(1)
        
        logger.info(f"New file detected: {file_path.name}")
        
        try:
            # Load and Index
            logger.info(f"Loading data from {file_path.name}...")
            reader = SimpleDirectoryReader(input_files=[str(file_path)])
            documents = reader.load_data()
            logger.info(f"Loaded {len(documents)} document chunks from {file_path.name}")
            
            # Index to Qdrant
            logger.info(f"Indexing {file_path.name} to Qdrant...")
            VectorStoreIndex.from_documents(
                documents,
                storage_context=self.storage_context,
            )
            
            logger.info(f"Successfully indexed {file_path.name}")
            
            # Sort and Move
            category = get_category(file_path)
            dest_dir = Path(PROCESSED_DIR) / category
            dest_dir.mkdir(parents=True, exist_ok=True)
            
            # Rename with timestamp to avoid collisions
            new_name = f"{int(time.time())}_{file_path.name}"
            shutil.move(str(file_path), str(dest_dir / new_name))
            
            logger.info(f"Moved {file_path.name} to {category}/")
            
        except Exception as e:
            logger.error(f"Error processing {file_path.name}: {e}")

def main():
    logger.info("Starting Ingestion Engine...")
    
    # Ensure directories exist
    os.makedirs(INBOX_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    
    # Initialize Qdrant
    client = QdrantClient(host=QDRANT_HOST, port=6333)
    vector_store = QdrantVectorStore(client=client, collection_name="rag_collection")
    
    handler = FileHandler(client, vector_store)
    observer = Observer()
    observer.schedule(handler, INBOX_DIR, recursive=False)
    observer.start()
    
    logger.info(f"Watching directory: {INBOX_DIR}")
    
    # Process existing files
    for file_path in Path(INBOX_DIR).iterdir():
        if file_path.is_file():
            handler.process_file(file_path)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    main()
