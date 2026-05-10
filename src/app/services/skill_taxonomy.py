import re
from typing import Literal, cast

RoleFamily = Literal["backend", "frontend", "data_ai", "devops", "fullstack"]

# Curated for common software engineering and data roles.
TECH_SKILLS = {
    "programming": [
        "python",
        "java",
        "javascript",
        "typescript",
        "c++",
        "c#",
        "go",
        "sql",
    ],
    "frameworks": [
        "fastapi",
        "django",
        "flask",
        "spring",
        "react",
        "node",
        "dotnet",
        "pytorch",
        "tensorflow",
    ],
    "cloud_devops": [
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "terraform",
        "ci/cd",
        "jenkins",
        "github actions",
    ],
    "data_ai": [
        "machine learning",
        "nlp",
        "llm",
        "rag",
        "pandas",
        "numpy",
        "scikit-learn",
        "postgresql",
        "mongodb",
    ],
}

SKILL_ALIASES = {
    "py": "python",
    "nodejs": "node",
    "node.js": "node",
    ".net": "dotnet",
    "dotnet": "dotnet",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "k8s": "kubernetes",
    "tf": "terraform",
    "js": "javascript",
    "ts": "typescript",
    "ml": "machine learning",
    "genai": "llm",
    "large language model": "llm",
    "large language models": "llm",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "amazon web services": "aws",
    "google cloud": "gcp",
}

RELATED_SKILL_GRAPH = {
    "python": {"django", "flask", "fastapi", "pandas", "numpy", "scikit-learn"},
    "javascript": {"typescript", "react", "node"},
    "typescript": {"javascript", "react", "node"},
    "sql": {"postgresql", "mongodb"},
    "postgresql": {"sql"},
    "machine learning": {"pytorch", "tensorflow", "scikit-learn", "numpy", "pandas", "llm", "nlp"},
    "llm": {"nlp", "rag", "machine learning"},
    "nlp": {"llm", "machine learning"},
    "aws": {"docker", "kubernetes", "terraform", "github actions", "jenkins"},
    "azure": {"docker", "kubernetes", "terraform", "github actions", "jenkins"},
    "gcp": {"docker", "kubernetes", "terraform", "github actions", "jenkins"},
    "kubernetes": {"docker", "terraform", "aws", "azure", "gcp"},
    "terraform": {"kubernetes", "aws", "azure", "gcp"},
    "ci/cd": {"jenkins", "github actions"},
}

ROLE_KEYWORDS = {
    "backend": ["backend", "api", "microservice", "server-side"],
    "frontend": ["frontend", "ui", "ux", "web", "react"],
    "data_ai": ["data", "ml", "ai", "machine learning", "nlp", "llm"],
    "devops": ["devops", "sre", "platform", "infra", "kubernetes"],
    "fullstack": ["full stack", "fullstack"],
}

ROLE_PROFILE_WEIGHTS = {
    "backend": {"required": 0.45, "must_have": 0.30, "nice": 0.10, "experience": 0.15},
    "frontend": {"required": 0.40, "must_have": 0.30, "nice": 0.15, "experience": 0.15},
    "data_ai": {"required": 0.40, "must_have": 0.35, "nice": 0.10, "experience": 0.15},
    "devops": {"required": 0.35, "must_have": 0.40, "nice": 0.10, "experience": 0.15},
    "fullstack": {"required": 0.45, "must_have": 0.25, "nice": 0.15, "experience": 0.15},
}

CANONICAL_SKILLS = {skill for group in TECH_SKILLS.values() for skill in group}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _contains_term(text: str, term: str) -> bool:
    pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
    return re.search(pattern, text) is not None


def normalize_skill_name(skill: str) -> str:
    normalized = normalize_text(skill)
    return SKILL_ALIASES.get(normalized, normalized)


def extract_skills(text: str) -> set[str]:
    normalized = normalize_text(text)
    found: set[str] = set()

    for skill in CANONICAL_SKILLS:
        if _contains_term(normalized, skill):
            found.add(skill)

    for alias, canonical in SKILL_ALIASES.items():
        if _contains_term(normalized, alias):
            found.add(canonical)

    return found


def infer_role_family(job_title: str, job_description: str) -> RoleFamily:
    text = normalize_text(f"{job_title} {job_description}")

    scores: dict[str, int] = {role: 0 for role in ROLE_KEYWORDS}
    for role, keywords in ROLE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[role] += 1

    inferred = max(scores, key=lambda role: scores[role])
    if scores[inferred] == 0:
        return "backend"
    return cast(RoleFamily, inferred)


def normalize_skill_list(skills: list[str]) -> list[str]:
    cleaned = {
        normalize_skill_name(skill)
        for skill in skills
        if normalize_skill_name(skill)
    }
    return sorted(cleaned)


def get_semantic_skill_matches(required_skills: list[str], resume_skills: set[str]) -> dict[str, list[str]]:
    semantic_matches: dict[str, list[str]] = {}
    for skill in required_skills:
        normalized_skill = normalize_skill_name(skill)
        if normalized_skill in resume_skills:
            continue

        related = RELATED_SKILL_GRAPH.get(normalized_skill, set())
        supports = sorted(resume_skills.intersection(related))
        if supports:
            semantic_matches[normalized_skill] = supports

    return semantic_matches
