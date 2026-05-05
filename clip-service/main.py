import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import CLIPModel, CLIPProcessor
from PIL import Image
import numpy as np

app = FastAPI()

# Load model and processor at startup
MODEL_NAME = "openai/clip-vit-base-patch32"
model = CLIPModel.from_pretrained(MODEL_NAME)
processor = CLIPProcessor.from_pretrained(MODEL_NAME)
model.eval()

# Pre-defined tag vocabulary
CATEGORIES = {
    "Scenes": ["beach", "mountain", "forest", "city", "countryside", "desert", "ocean", "lake", "river", "waterfall", "sky", "sunset", "sunrise", "night", "snow", "rain", "fog", "indoor", "outdoor", "garden", "street", "road", "park", "building", "architecture"],
    "Subjects": ["person", "group of people", "child", "baby", "animal", "dog", "cat", "bird", "car", "food", "meal", "drink", "plant", "flower", "tree"],
    "Events": ["wedding", "birthday party", "celebration", "travel", "vacation", "festival", "sport", "concert", "graduation", "family gathering"],
    "Mood": ["happy", "peaceful", "dramatic", "colorful", "dark", "bright", "vintage", "modern"],
    "Documents": ["document", "receipt", "bill", "passport", "id card", "certificate", "letter", "form", "handwritten note", "ticket", "invoice"]
}

# Flatten tags and map to category
ALL_TAGS = []
TAG_TO_CATEGORY = {}
for category, tags in CATEGORIES.items():
    for tag in tags:
        ALL_TAGS.append(tag)
        TAG_TO_CATEGORY[tag] = category

class ImageEmbedRequest(BaseModel):
    image_path: str

class TextEmbedRequest(BaseModel):
    text: str

class ClassifyRequest(BaseModel):
    image_path: str
    threshold: float = 0.22

def load_image(image_path: str) -> Image.Image:
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        return Image.open(image_path).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read image: {str(e)}")

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}

@app.post("/embed")
def embed_image(req: ImageEmbedRequest) -> dict:
    image = load_image(req.image_path)
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        
    # L2-normalize
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    embedding = image_features.squeeze().cpu().numpy().tolist()
    
    return {"embedding": embedding, "dim": len(embedding)}

@app.post("/embed-text")
def embed_text(req: TextEmbedRequest) -> dict:
    inputs = processor(text=[req.text], return_tensors="pt", padding=True)
    
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        
    # L2-normalize
    text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
    embedding = text_features.squeeze().cpu().numpy().tolist()
    
    return {"embedding": embedding, "dim": len(embedding)}

@app.post("/classify")
def classify_image(req: ClassifyRequest) -> dict:
    image = load_image(req.image_path)
    # We use prompt template for better zero-shot performance
    text_inputs = [f"a photo of a {tag}" for tag in ALL_TAGS]
    
    inputs = processor(text=text_inputs, images=image, return_tensors="pt", padding=True)
    
    with torch.no_grad():
        outputs = model(**inputs)
        
    logits_per_image = outputs.logits_per_image # this is the image-text similarity score
    probs = logits_per_image.softmax(dim=1).squeeze().cpu().numpy()
    
    results = []
    for i, prob in enumerate(probs):
        if prob >= req.threshold:
            tag = ALL_TAGS[i]
            results.append({
                "tag": tag,
                "category": TAG_TO_CATEGORY[tag],
                "score": float(prob)
            })
            
    # Sort descending
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return {"tags": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001)
