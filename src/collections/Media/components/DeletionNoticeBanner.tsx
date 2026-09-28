export function DeletionNoticeBanner({ count }: { count: number }): React.ReactNode {
  if (count === 0) return null

  return (
    <div
      role="status"
      style={{
        background: "var(--theme-warning-100)",
        border: "1px solid var(--theme-warning-500)",
        borderRadius: "4px",
        color: "var(--theme-warning-900)",
        fontSize: "0.8125rem",
        marginBottom: "0.75rem",
        padding: "0.5rem 0.75rem",
      }}
    >
      <strong>Can&apos;t be deleted while in use</strong>
      <br />
      Used in {count} published document{count === 1 ? "" : "s"}, so deleting it will be refused.
      See the References tab for details.
    </div>
  )
}
