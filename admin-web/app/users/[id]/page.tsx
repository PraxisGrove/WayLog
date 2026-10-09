import { UserDetailPage } from "@/components/pages/user-detail-page";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <UserDetailPage userId={id} />;
}
