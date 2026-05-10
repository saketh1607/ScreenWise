from typing import Literal

from pydantic import BaseModel, Field


RoleFamily = Literal["backend", "frontend", "data_ai", "devops", "fullstack"]


class CandidateInput(BaseModel):
    name: str = Field(..., min_length=1)
    resume_text: str = Field(..., min_length=30)
    years_experience: float = Field(0, ge=0)
    email: str | None = None
    phone: str | None = None
    source_file: str | None = None


class AnalyzeRequest(BaseModel):
    job_title: str = Field(..., min_length=2)
    job_description: str = Field(..., min_length=50)
    candidates: list[CandidateInput] = Field(..., min_length=1)
    role_family: RoleFamily | None = None
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)


class CandidateScore(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    source_file: str | None = None
    total_score: float
    role_family: RoleFamily
    skill_score: float
    must_have_match_rate: float
    nice_to_have_match_rate: float
    experience_score: float
    cosine_similarity_score: float = 0.0
    hard_constraint_passed: bool
    matched_skills: list[str]
    missing_skills: list[str]
    extracted_keywords: list[str] = Field(default_factory=list)
    extracted_entities: dict[str, list[str]] = Field(default_factory=dict)
    semantic_matches: dict[str, list[str]]
    strengths: list[str]
    concerns: list[str]


class AnalyzeResponse(BaseModel):
    scan_id: str | None = None
    created_at: str | None = None
    job_title: str
    role_family: RoleFamily
    required_skills: list[str]
    must_have_skills: list[str]
    nice_to_have_skills: list[str]
    ranked_candidates: list[CandidateScore]


class UploadProfilePreview(BaseModel):
    file_name: str
    status: Literal["ok", "error"]
    candidate_name: str | None = None
    years_experience: float | None = None
    email: str | None = None
    phone: str | None = None
    detected_skills: list[str] = Field(default_factory=list)
    message: str | None = None


class PreviewFilesResponse(BaseModel):
    previews: list[UploadProfilePreview]
