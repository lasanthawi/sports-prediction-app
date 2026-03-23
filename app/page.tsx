import HomeClient from '@/app/components/home/HomeClient'
import { getHomePageData } from '@/lib/homepage'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const initialData = await getHomePageData()
  return <HomeClient initialData={initialData} />
}
