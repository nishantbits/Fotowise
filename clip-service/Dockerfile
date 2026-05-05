FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV / Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install Python packages
# torch CPU-only wheels are ONLY on download.pytorch.org — pip's default index
# does not have the +cpu suffix builds. We use --find-links (or --extra-index-url)
# pointing to the PyTorch CPU wheel index.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt

# Pre-download the CLIP model into the image layer so startup is instant
# (Hugging Face will use /root/.cache/huggingface by default)
RUN python -c "\
from transformers import CLIPModel, CLIPProcessor; \
CLIPModel.from_pretrained('openai/clip-vit-base-patch32'); \
CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32'); \
print('CLIP model cached successfully')"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
