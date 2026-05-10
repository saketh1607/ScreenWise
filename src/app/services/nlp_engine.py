from collections import Counter
import math
import re

from app.services.skill_taxonomy import extract_skills

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "our",
    "the",
    "to",
    "with",
    "you",
    "your",
    "we",
    "will",
    "this",
    "that",
}

DEGREE_PATTERNS = [
    r"\b(?:b\.?tech|bachelor(?:'s)?|bsc|b\.?e\.?)\b",
    r"\b(?:m\.?tech|master(?:'s)?|msc|m\.?e\.?)\b",
    r"\b(?:ph\.?d|doctorate)\b",
]

CERTIFICATION_PATTERNS = [
    r"\baws certified [a-z\s-]+",
    r"\bgoogle cloud [a-z\s-]+",
    r"\bcertified kubernetes administrator\b",
    r"\bhashicorp terraform associate\b",
    r"\btensorflow developer certificate\b",
    r"\boracle java professional\b",
]


def clean_text(text: str) -> str:
    lowered = text.lower()
    lowered = re.sub(r"[^a-z0-9+#./\s-]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def tokenize(text: str) -> list[str]:
    cleaned = clean_text(text)
    tokens = re.findall(r"[a-z0-9+#./-]+", cleaned)
    return [token for token in tokens if len(token) > 1 and token not in STOP_WORDS]


def extract_keywords(text: str, limit: int = 12) -> list[str]:
    counts = Counter(tokenize(text))
    return [token for token, _ in counts.most_common(limit)]


def extract_entities(text: str) -> dict[str, list[str]]:
    cleaned = clean_text(text)
    return {
        "skills": sorted(extract_skills(text)),
        "education": _unique_pattern_matches(cleaned, DEGREE_PATTERNS),
        "certifications": _unique_pattern_matches(cleaned, CERTIFICATION_PATTERNS),
        "experience_mentions": _unique_pattern_matches(
            cleaned,
            [r"\b\d+(?:\.\d+)?\+?\s+years?\s+(?:of\s+)?experience\b"],
        ),
    }


def tfidf_cosine_similarity(reference_text: str, candidate_text: str) -> float:
    reference_tokens = tokenize(reference_text)
    candidate_tokens = tokenize(candidate_text)
    if not reference_tokens or not candidate_tokens:
        return 0.0

    reference_counts = Counter(reference_tokens)
    candidate_counts = Counter(candidate_tokens)
    vocabulary = sorted(set(reference_counts).union(candidate_counts))
    document_count = 2

    reference_vector: list[float] = []
    candidate_vector: list[float] = []
    for term in vocabulary:
        document_frequency = int(term in reference_counts) + int(term in candidate_counts)
        idf = math.log((1 + document_count) / (1 + document_frequency)) + 1
        reference_vector.append(reference_counts.get(term, 0) * idf)
        candidate_vector.append(candidate_counts.get(term, 0) * idf)

    return round(_cosine(reference_vector, candidate_vector) * 100, 2)


def _cosine(left: list[float], right: list[float]) -> float:
    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot_product / (left_norm * right_norm)


def _unique_pattern_matches(text: str, patterns: list[str]) -> list[str]:
    matches: list[str] = []
    for pattern in patterns:
        matches.extend(match.group(0).strip() for match in re.finditer(pattern, text))
    return sorted(set(matches))
