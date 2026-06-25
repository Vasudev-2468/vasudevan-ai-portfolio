import "../globals.css";

export const metadata = { title: "vasudevan.ai · admin", robots: "noindex" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-aurora min-h-screen">{children}</div>;
}
