from app.services.nlp_engine import extract_entities, extract_keywords, tfidf_cosine_similarity


def test_tfidf_cosine_similarity_scores_related_text_higher():
    job_text = "Need Python FastAPI AWS Docker backend API experience"
    related_resume = "Built backend APIs using Python, FastAPI, Docker and AWS"
    unrelated_resume = "Created React landing pages and Figma design systems"

    related_score = tfidf_cosine_similarity(job_text, related_resume)
    unrelated_score = tfidf_cosine_similarity(job_text, unrelated_resume)

    assert related_score > unrelated_score
    assert related_score > 0


def test_extract_entities_returns_skills_education_and_certifications():
    text = (
        "B.Tech engineer with Python and FastAPI. "
        "AWS Certified Developer with 4 years of experience."
    )

    entities = extract_entities(text)
    keywords = extract_keywords(text)

    assert "python" in entities["skills"]
    assert "b.tech" in entities["education"]
    assert any("aws certified" in item for item in entities["certifications"])
    assert "python" in keywords
