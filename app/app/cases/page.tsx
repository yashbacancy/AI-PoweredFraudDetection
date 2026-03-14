import { TopHeader } from "@/components/app/top-header";
import { CasesClient } from "@/components/app/cases-client";
import { getLocalCases, getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { getSupabaseCases, getSupabaseTransactions } from "@/lib/supabase/repository";

export default async function CasesPage() {
  const [cases, transactions] = await Promise.all(
    IS_LOCAL_DB_MODE
      ? [getLocalCases(), getLocalTransactions(30)]
      : [getSupabaseCases(), getSupabaseTransactions(30)],
  );

  return (
    <>
      <TopHeader title="Fraud Cases" subtitle="Triage, investigate, and close suspicious activities." />
      <div className="page-content">
        <CasesClient initialCases={cases ?? []} transactions={transactions ?? []} />
      </div>
    </>
  );
}
