import { ReactNode } from "react";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function DataTable({ children }: { children: ReactNode }) {
  return <table className="min-w-full text-left text-sm">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-200 text-slate-500">{children}</thead>;
}

export function HeadCell({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function BodyRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-slate-100">{children}</tr>;
}

export function BodyCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 ${className}`.trim()}>{children}</td>;
}
