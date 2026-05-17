import { AppNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
        <footer className="mt-12 flex justify-end border-t border-border pt-4">
          <SignOutButton />
        </footer>
      </main>
    </>
  );
}
