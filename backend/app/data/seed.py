"""Seed data sourced from Vasudevan's resume."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


PROFILE = dict(
    name="Vasudevan Sundaramurthy",
    title="AI Researcher · Computer Vision Engineer · Data Scientist · PhD Scholar",
    tagline="Research, innovation, and intelligent systems.",
    summary=(
        "Recent data science graduate and PhD scholar in Mathematics with Data Science, "
        "specializing in statistical analysis, machine learning, and computer vision. "
        "Experienced in Python, deep learning, and full-stack development with Next.js and "
        "FastAPI. Seeking research and engineering opportunities to apply mathematical "
        "modelling and AI for real-world impact."
    ),
    email="svasudevanidvrs@gmail.com",
    phone="+91 6383268660",
    location="Tirupathur, India 635853",
    links={
        "github": "https://github.com/Vasudev-2468",
        "kaggle": "https://www.kaggle.com/vasudevan2468",
        "scopus": "https://www.scopus.com/authid/detail.uri?authorId=59344026000",
        "scholar": "https://shorturl.at/m79Kr",
    },
)


EXPERIENCES = [
    dict(
        role="Data Analyst Trainer",
        company="Guardians EdTech",
        location="Bangalore, India",
        start_date="09/2025",
        end_date="Current",
        description=(
            "Data Analytics instructor specializing in Excel, SQL, Python, and advanced BI "
            "tools. Run workshops, design curriculum, and train learners on applied "
            "statistics, probability distributions, ML fundamentals, and visualization with "
            "a focus on real-world insights and strategic decision-making."
        ),
        order_index=0,
    ),
    dict(
        role="Data Science Trainer",
        company="ISBR Business School",
        location="Bangalore, India",
        start_date="03/2025",
        end_date="Current",
        description=(
            "Lead training sessions and workshops on fundamental machine learning "
            "concepts, algorithms, and tools. Designed a hands-on curriculum covering "
            "supervised / unsupervised learning, deep learning, data preprocessing, model "
            "evaluation, and deployment using Python, scikit-learn, TensorFlow, and cloud "
            "platforms. Mentor students on practical ML projects."
        ),
        order_index=1,
    ),
    dict(
        role="Software Delivery Processes Intern",
        company="Ion Idea",
        location="India",
        start_date="06/2023",
        end_date="12/2023",
        description=(
            "Improved software delivery efficiency by 15% by optimizing project "
            "management processes. Coordinated project workflows, implemented quality "
            "assurance measures, and handled client queries through backend processes."
        ),
        order_index=2,
    ),
]


EDUCATION = [
    dict(
        degree="Ph.D. in Mathematics with Data Science",
        institution="Hindustan Institute of Technology and Science",
        location="Chennai",
        year="2026",
        order_index=0,
    ),
    dict(
        degree="Master of Science in Mathematics",
        institution="Reva University",
        location="Bangalore",
        year="2022",
        order_index=1,
    ),
    dict(
        degree="Bachelor of Science in Mathematics",
        institution="Sri Vidya Mandir Arts & Science College",
        location="Krishnagiri",
        year="2020",
        order_index=2,
    ),
]


SKILLS = [
    dict(name="Deep Learning", category="AI/ML", proficiency=90),
    dict(name="Machine Learning", category="AI/ML", proficiency=92),
    dict(name="Computer Vision", category="AI/ML", proficiency=88),
    dict(name="Natural Language Processing", category="AI/ML", proficiency=85),
    dict(name="Time Series Analysis", category="AI/ML", proficiency=80),
    dict(name="Python", category="Languages", proficiency=95),
    dict(name="HTML / CSS", category="Languages", proficiency=80),
    dict(name="SQL", category="Data", proficiency=88),
    dict(name="PostgreSQL", category="Data", proficiency=80),
    dict(name="Redis", category="Data", proficiency=70),
    dict(name="Qdrant (Vector DB)", category="Data", proficiency=70),
    dict(name="Next.js", category="Web", proficiency=78),
    dict(name="React.js", category="Web", proficiency=78),
    dict(name="FastAPI", category="Web", proficiency=82),
    dict(name="Prisma", category="Web", proficiency=70),
    dict(name="Matplotlib", category="Visualization", proficiency=88),
    dict(name="TensorFlow", category="AI/ML", proficiency=82),
    dict(name="scikit-learn", category="AI/ML", proficiency=90),
]


PROJECTS = [
    dict(
        title="Journal Management System",
        role="Full-Stack Developer",
        year="2026",
        summary=(
            "Production-ready, workflow-driven journal management system automating peer "
            "review for academic publishers. Designed and implemented 5 autonomous agents "
            "handling submission acknowledgement, format validation, reviewer suggestion, "
            "secure link generation, and multi-channel notifications."
        ),
        achievements=[
            "Reduced editorial processing time by an estimated 60% through automated peer-review workflow.",
            "Integrated ORCID, OpenAlex, and Twilio WhatsApp Business APIs for identity, reviewer suggestion, and real-time alerts.",
            "Implemented secure, expiring review links with token-based authentication (no login required for reviewers).",
            "Built auto-format validation: PDF/A compliance, abstract length, ORCID presence, and plagiarism scoring via iThenticate API.",
            "Designed a 12+ table database schema covering submissions, reviews, assignments, and notification logging.",
            "Shipped a dual-channel notification system (Email + WhatsApp) for instant editorial alerts.",
        ],
        tech_stack=[
            "Laravel/Django", "PostgreSQL", "Redis", "Twilio API",
            "ORCID API", "OpenAlex API", "Tailwind", "AWS EC2", "AWS RDS", "AWS SQS",
        ],
        repo_url=None,
        demo_url=None,
    ),
    dict(
        title="Lower GI Disease Classification",
        role="Researcher · PhD Work",
        year="2025",
        summary=(
            "Deep learning and fuzzy-logic pipeline for classification and detection of "
            "lower gastrointestinal endoscopy images. Combines mathematical modelling "
            "with CNN/ML ensembles and published across multiple journals and conferences."
        ),
        achievements=[
            "Recognized with the Dr. T. A. Lourdusamy Innovation Award.",
            "Published in SSRG IJECE and IJETT with mathematical modelling foundations.",
            "Conference presentation at ICPCSN 2025 on fuzzy logic + ML classification.",
        ],
        tech_stack=["Python", "TensorFlow", "PyTorch", "OpenCV", "scikit-learn", "Fuzzy Logic"],
    ),
    dict(
        title="Context-Aware Phishing Detection",
        role="Researcher",
        year="2025",
        summary=(
            "Hybrid Transformer + BiLSTM architecture for cybersecurity-grade phishing "
            "URL and content classification, presented at ICISC 2025."
        ),
        achievements=[
            "Outperformed baseline LSTM/BERT models on contextual phishing detection.",
            "Published in proceedings of 9th International Conference on Inventive Systems and Control (ICISC).",
        ],
        tech_stack=["PyTorch", "Transformers", "BiLSTM", "Python", "HuggingFace"],
    ),
    dict(
        title="Online Transaction Fraud Detection",
        role="Researcher",
        year="2024",
        summary=(
            "ML pipeline for banking-sector fraud detection focusing on imbalanced data "
            "handling, feature engineering, and ensemble models."
        ),
        achievements=[
            "Published in Edelweiss Applied Science and Technology (Vol 8, Issue 5).",
        ],
        tech_stack=["Python", "scikit-learn", "XGBoost", "Pandas"],
    ),
    dict(
        title="Pothole Identification Patent",
        role="Inventor",
        year="2024",
        summary=(
            "Patent-filed prompt-response system to identify serious potholes on public "
            "roads and prevent collisions using computer vision."
        ),
        achievements=[
            "Patent filed with Intellectual Property India (Ref. 202441070731, CBR 57627).",
        ],
        tech_stack=["Computer Vision", "Deep Learning", "Edge Inference"],
    ),
]


PUBLICATIONS = [
    # Journals
    dict(
        title="Cutting-Edge Image Processing of Lower Gastrointestinal Tract Using Deep Learning",
        authors="Vasudevan, S.; Govindan, Vediyappan; Byeon, Haewon",
        venue="SSRG International Journal of Electronics and Communication Engineering, Vol 12, Issue 4",
        year=2025,
        kind="journal",
    ),
    dict(
        title="Mathematical Modelling for Generalized Lower Gastrointestinal Image Based Classification and Detection on Both ML and DL Techniques",
        authors="Vasudevan, S.; Govindan, Vediyappan; Byeon, Haewon",
        venue="International Journal of Engineering Trends and Technology, Vol 73, Issue 1",
        year=2025,
        kind="journal",
        url="/papers/math-modelling-lower-gi.pdf",
    ),
    dict(
        title="Online Transaction Fraud Detection in the Banking Sector Using Machine Learning Techniques",
        authors="Vasudevan, S.; Govindan, Vediyappan; Byeon, Haewon",
        venue="Edelweiss Applied Science and Technology, Vol 8, Issue 5",
        year=2024,
        kind="journal",
    ),
    dict(
        title="Secure Public Key Cryptosystem for Smart City Using Algebraic Structure",
        authors="V. Muthukumaran; S. Vasudevan; Syeda Ayesha Siddiqha",
        venue="International Journal of Human Computations & Intelligence, Vol 2, Issue 1",
        year=2023,
        kind="journal",
    ),
    dict(
        title="Systematic Reliability Optimization (ASRO)",
        authors="Hee Sik Kim; Choonkil Park; Vediyappan Govindan; S. Vasudevan; G. Jagan Kumar",
        venue="Babylonian Journal of Mathematics, Vol 2023",
        year=2023,
        kind="journal",
    ),
    # Conferences
    dict(
        title="Gastrointestinal Endoscopy Classification Using Fuzzy Logic and Machine Learning Algorithms",
        authors="Vasudevan, S.; Govindan, Vediyappan",
        venue="5th International Conference on Pervasive Computing and Social Networking (ICPCSN), Coimbatore",
        year=2025,
        kind="conference",
        url="/papers/gi-fuzzy-logic-ml.pdf",
    ),
    dict(
        title="Gold Rate Historical Data Analysis",
        authors="Sundaramurthy, Vasudevan; Govindan, Vediyappan",
        venue="Lecture Notes in Networks and Systems — SoCPaR 2023, Auburn, Washington, USA",
        year=2023,
        kind="conference",
        doi="10.1007/978-3-031-81086-2_5",
    ),
    dict(
        title="Context-Aware Phishing: Leveraging Transformer and BiLSTM Networks for Cybersecurity",
        authors="S. Vasudevan; Vediyappan Govindan",
        venue="9th International Conference on Inventive Systems and Control (ICISC), Erode",
        year=2025,
        kind="conference",
        url="/papers/context-aware-phishing.pdf",
    ),
    # Patent
    dict(
        title="Prompt Response to the Identification of Serious Potholes on Public Roads in Order to Forestall Collisions",
        authors="Vasudevan S.; Govindan; Piriadarashani",
        venue="Intellectual Property India — Patent Ref. 202441070731, CBR 57627, FORM-1",
        year=2024,
        kind="patent",
        url="/papers/pothole-patent.pdf",
    ),
]


CERTIFICATIONS = [
    dict(name="IBM Certified on Machine Learning", issuer="IT Vedant, Bangalore", year=None),
    dict(name="Deep Learning", issuer="IT Vedant, Bangalore", year=None),
    dict(name="Natural Language Processing", issuer="IT Vedant, Bangalore", year=None),
    dict(name="Dr. T. A. Lourdusamy Innovation Award", issuer="Hindustan Institute of Technology and Science", year=None),
]


async def _already_seeded(session: AsyncSession) -> bool:
    result = await session.execute(select(models.Profile).limit(1))
    return result.scalar_one_or_none() is not None


async def seed_all(session: AsyncSession) -> None:
    if await _already_seeded(session):
        return

    session.add(models.Profile(**PROFILE))
    session.add_all(models.Experience(**e) for e in EXPERIENCES)
    session.add_all(models.Education(**e) for e in EDUCATION)
    session.add_all(models.Skill(**s) for s in SKILLS)
    session.add_all(models.Project(**p) for p in PROJECTS)
    session.add_all(models.Publication(**p) for p in PUBLICATIONS)
    session.add_all(models.Certification(**c) for c in CERTIFICATIONS)
    await session.commit()
