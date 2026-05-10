from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.web.routes import router as web_router

app = FastAPI(
    title="AI Resume Screening and Analysis System",
    version="0.1.0",
    description="Tech-role focused candidate screening API with explainable ranking.",
)

# Allow dashboard access from alternate local origins (e.g., VS Code Live Server).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="src/app/web/static"), name="static")

app.include_router(web_router)
app.include_router(router)
