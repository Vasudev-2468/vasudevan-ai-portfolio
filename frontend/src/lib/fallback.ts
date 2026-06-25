import type { Profile, Experience, Education, Skill, Project, Publication, Certification } from "./api";

/** Used when the backend is unreachable (offline preview / static build). */
export const fallback = {
  profile: {
    id: 0,
    name: "Vasudevan Sundaramurthy",
    title: "AI Researcher · Computer Vision Engineer · Data Scientist · PhD Scholar",
    tagline: "Research, innovation, and intelligent systems.",
    summary:
      "PhD scholar in Mathematics with Data Science. Building computer vision and NLP systems backed by mathematical modelling.",
    email: "svasudevanidvrs@gmail.com",
    phone: "+91 6383268660",
    location: "Tirupathur, India",
    links: {
      github: "https://github.com/Vasudev-2468",
      kaggle: "https://www.kaggle.com/vasudevan2468",
      scopus: "https://www.scopus.com/authid/detail.uri?authorId=59344026000",
      scholar: "https://shorturl.at/m79Kr",
    },
  } satisfies Profile,
  experience: [] as Experience[],
  education: [] as Education[],
  skills: [] as Skill[],
  projects: [] as Project[],
  publications: [] as Publication[],
  certifications: [] as Certification[],
};
