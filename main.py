import os
from datetime import datetime
from typing import List
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load local environment variables from .env file
load_dotenv()

app = FastAPI(title="Gemini Raw Chat API")

# Add CORS middleware to support decoupled frontends (e.g. React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

def stream_gemini(messages: List[ChatMessage]):
    try:
        # genai.Client() automatically picks up GEMINI_API_KEY from environment variables
        client = genai.Client()
        model = "gemini-2.5-flash"
        
        # Combine all incoming query contents from the user into a single text prompt
        combined_prompt = "\n".join([m.content for m in messages if m.content])
        
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=combined_prompt)]
            )
        ]
        
        # Enable the Google Search tool for the model
        tools = [
            types.Tool(googleSearch=types.GoogleSearch()),
        ]
        
        current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        system_instruction = (
            "You are a helpful AI assistant. You have access to a Google Search tool and should use it to answer "
            f"queries when you need up-to-date information, news, or factual details. Current date and time: {current_time_str}."
        )
        
        generate_content_config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
        )
        
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"\n[Error: {str(e)}]"

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        stream_gemini(request.messages),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
