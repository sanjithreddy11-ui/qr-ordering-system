export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[480px] relative">
      <div className="washi-bg" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}