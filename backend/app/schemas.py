from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProfileOut(ORMBase):
    id: int
    name: str
    title: str
    tagline: str
    summary: str
    email: str
    phone: str
    location: str
    links: dict
    photo_url: str | None = None


class ExperienceOut(ORMBase):
    id: int
    role: str
    company: str
    location: str
    start_date: str
    end_date: str
    description: str
    order_index: int


class EducationOut(ORMBase):
    id: int
    degree: str
    institution: str
    location: str
    year: str
    order_index: int


class SkillOut(ORMBase):
    id: int
    name: str
    category: str
    proficiency: int


class ProjectOut(ORMBase):
    id: int
    title: str
    role: str
    year: str
    summary: str
    achievements: list[str]
    tech_stack: list[str]
    repo_url: str | None = None
    demo_url: str | None = None


class PublicationOut(ORMBase):
    id: int
    title: str
    authors: str
    venue: str
    year: int
    kind: str
    doi: str | None = None
    url: str | None = None


class CertificationOut(ORMBase):
    id: int
    name: str
    issuer: str
    year: str | None = None


class AssistantQuery(BaseModel):
    # Bounded — every LLM call is billable, so a public endpoint must
    # never accept unlimited text. 2000 chars fits any well-formed
    # question and prevents a single request from ballooning the
    # provider bill.
    session_id: str = Field(default="anonymous", max_length=128)
    message: str = Field(min_length=1, max_length=2000)


class AssistantReply(BaseModel):
    session_id: str
    reply: str
    sources: list[str] = []
    mode: str = "keyword"  # llm | keyword | empty
    created_at: datetime
