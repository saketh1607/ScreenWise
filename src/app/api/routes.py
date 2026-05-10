import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CandidateInput,
    PreviewFilesResponse,
    UploadProfilePreview,
)
from app.services.resume_parser import (
    ResumeParsingError,
    extract_contact_details,
    extract_candidate_profile,
    parse_resume_bytes,
)
from app.services.scoring import build_skill_context, rank_candidates
from app.services.skill_taxonomy import extract_skills

router = APIRouter(prefix="/v1", tags=["screening"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    role_family, required_skills, must_have_skills, nice_to_have_skills = build_skill_context(
        request.job_title,
        request.job_description,
        request.role_family,
        request.must_have_skills,
        request.nice_to_have_skills,
    )
    ranked = rank_candidates(
        request.candidates,
        f"{request.job_title} {request.job_description}",
        role_family,
        required_skills,
        must_have_skills,
        nice_to_have_skills,
    )

    top_limit = int(os.getenv("TOP_CANDIDATES_LIMIT", "100"))

    return AnalyzeResponse(
        job_title=request.job_title,
        role_family=role_family,
        required_skills=required_skills,
        must_have_skills=must_have_skills,
        nice_to_have_skills=nice_to_have_skills,
        ranked_candidates=ranked[:top_limit],
    )


def _parse_csv_field(raw_value: str) -> list[str]:
    if not raw_value.strip():
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


@router.post("/preview-files", response_model=PreviewFilesResponse)
async def preview_files(resumes: list[UploadFile] = File(...)) -> PreviewFilesResponse:
    previews: list[UploadProfilePreview] = []

    for idx, resume in enumerate(resumes):
        file_name = resume.filename or f"candidate-{idx + 1}.txt"
        try:
            content = await resume.read()
            resume_text = parse_resume_bytes(file_name, content)
            candidate_name, years = extract_candidate_profile(resume_text, file_name)
            email, phone = extract_contact_details(resume_text)
            skills = sorted(extract_skills(resume_text))[:8]

            previews.append(
                UploadProfilePreview(
                    file_name=file_name,
                    status="ok",
                    candidate_name=candidate_name,
                    years_experience=years,
                    email=email,
                    phone=phone,
                    detected_skills=skills,
                    message="Profile parsed successfully.",
                )
            )
        except ResumeParsingError as exc:
            previews.append(
                UploadProfilePreview(
                    file_name=file_name,
                    status="error",
                    message=str(exc),
                )
            )

    return PreviewFilesResponse(previews=previews)


@router.post("/analyze-files", response_model=AnalyzeResponse)
async def analyze_files(
    job_title: str = Form(...),
    job_description: str = Form(...),
    role_family: str | None = Form(default=None),
    must_have_skills: str = Form(default=""),
    nice_to_have_skills: str = Form(default=""),
    resumes: list[UploadFile] = File(...),
) -> AnalyzeResponse:
    candidates: list[CandidateInput] = []

    for idx, resume in enumerate(resumes):
        try:
            content = await resume.read()
            resume_text = parse_resume_bytes(resume.filename or "resume.txt", content)
        except ResumeParsingError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        file_name = resume.filename or f"candidate-{idx + 1}.txt"
        candidate_name, years = extract_candidate_profile(resume_text, file_name)
        email, phone = extract_contact_details(resume_text)

        candidates.append(
            CandidateInput(
                name=candidate_name,
                resume_text=resume_text,
                years_experience=years,
                email=email,
                phone=phone,
                source_file=file_name,
            )
        )

    role, required, must_have, nice_to_have = build_skill_context(
        job_title,
        job_description,
        role_family,
        _parse_csv_field(must_have_skills),
        _parse_csv_field(nice_to_have_skills),
    )

    ranked = rank_candidates(
        candidates,
        f"{job_title} {job_description}",
        role,
        required,
        must_have,
        nice_to_have,
    )
    top_limit = int(os.getenv("TOP_CANDIDATES_LIMIT", "100"))

    return AnalyzeResponse(
        job_title=job_title,
        role_family=role,
        required_skills=required,
        must_have_skills=must_have,
        nice_to_have_skills=nice_to_have,
        ranked_candidates=ranked[:top_limit],
    )
