import About from "@/components/About";
import AIAvatar from "@/components/avatar/AIAvatar";
import Assistant from "@/components/Assistant";
import Contact from "@/components/Contact";
import Cursor from "@/components/Cursor";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import GlobalBackdrop from "@/components/3d/GlobalBackdrop";
import Hero from "@/components/Hero";
import IntroLoader from "@/components/IntroLoader";
import NavBar from "@/components/NavBar";
import News from "@/components/News";
import Projects from "@/components/Projects";
import Publications from "@/components/Publications";
import ScrollProgress from "@/components/ScrollProgress";
import Skills from "@/components/Skills";
import VisitorTracker from "@/components/VisitorTracker";
import { api } from "@/lib/api";
import { fallback } from "@/lib/fallback";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, experience, education, skills, projects, publications, certifications, aiNews, customFields] =
    await Promise.all([
      api.profile(),
      api.experience(),
      api.education(),
      api.skills(),
      api.projects(),
      api.publications(),
      api.certifications(),
      api.aiNews(),
      api.publicCustomFields(),
    ]);

  const p = profile ?? fallback.profile;
  const xp = experience ?? fallback.experience;
  const pubs = publications ?? fallback.publications;
  const aiFeed = aiNews?.items ?? [];
  const fields = customFields ?? [];

  return (
    <main id="top" className="relative">
      <GlobalBackdrop />
      <IntroLoader />
      <VisitorTracker />
      <ScrollProgress />
      <Cursor />
      <div className="grain" aria-hidden />
      <NavBar />
      <Hero profile={p} customFields={fields} />
      <div className="mx-auto max-w-6xl px-6 md:px-10"><div className="section-divider" aria-hidden /></div>
      <About
        profile={p}
        education={education ?? fallback.education}
        certifications={certifications ?? fallback.certifications}
      />
      <ExperienceTimeline items={xp} />
      <Publications items={pubs} />
      <Projects items={projects ?? fallback.projects} />
      <Skills items={skills ?? fallback.skills} />
      <News publications={pubs} experience={xp} aiFeed={aiFeed} />
      <AIAvatar />
      <Assistant />
      <Contact profile={p} />
    </main>
  );
}
