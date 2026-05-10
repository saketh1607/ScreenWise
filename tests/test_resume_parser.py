from app.services.resume_parser import extract_candidate_profile, extract_contact_details


def test_extract_candidate_profile_from_name_and_experience_lines():
    text = "Name: Prashant Singh Email: prashant@gmail.com Years of Experience: 3"
    name, years = extract_candidate_profile(text, "resume.pdf")

    assert name == "Prashant Singh"
    assert years == 3.0


def test_extract_candidate_profile_from_email_and_fallback():
    text = "Contact: ananya.verma98@example.com Built backend APIs with Python."
    name, years = extract_candidate_profile(text, "candidate_profile.docx")

    assert name == "Ananya Verma"
    assert years == 0.0


def test_extract_contact_details_from_resume_text():
    text = "Name: Aman Sharma Email: aman@example.com Phone: +91 98765 43210"
    email, phone = extract_contact_details(text)

    assert email == "aman@example.com"
    assert phone == "+91 98765 43210"
