import { TopHeader } from "@/components/app/top-header";
import { TransactionsClient } from "@/components/app/transactions-client";
import { getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export default async function TransactionsPage() {
  if (IS_LOCAL_DB_MODE) {
    const data = await getLocalTransactions();
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

  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });

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
