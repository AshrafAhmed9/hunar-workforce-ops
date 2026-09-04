import re


def derive_screening_schema(jd: str) -> dict[str, str]:
    terms = re.findall(
        r"(?:Python|JavaScript|TypeScript|React|SQL|AWS|Docker|Kubernetes|Java)",
        jd,
        re.IGNORECASE,
    )
    skills = list(dict.fromkeys(t.title() for t in terms))[:5]
    return {
        "overall_fit": "string — one of: strong, moderate, weak",
        "must_have_evidence": f"string — evidence for {', '.join(skills) or 'role requirements'}",
        "availability": "string — notice period and start date",
        "compensation_expectation": "string — candidate expectation",
        "next_step": "string — one of: advance, hold, decline",
    }
