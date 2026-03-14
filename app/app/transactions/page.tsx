import { TopHeader } from "@/components/app/top-header";
import { TransactionsClient } from "@/components/app/transactions-client";
import { getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { getSupabaseTransactions } from "@/lib/supabase/repository";

export default async function TransactionsPage() {
  const data = IS_LOCAL_DB_MODE
    ? await getLocalTransactions()
    : await getSupabaseTransactions();

  return (
    <>
      <TopHeader
        title="Transactions"
        subtitle="Real-time scoring, velocity signals, and fraud decision outcomes."
      />
      <div className="page-content">
        <TransactionsClient initialData={data ?? []} />
      </div>
    </>
  );
}
