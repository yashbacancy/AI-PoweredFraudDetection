export function TopHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="app-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
