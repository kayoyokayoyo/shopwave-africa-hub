import { queryOptions } from "@tanstack/react-query";
import { getPublicShop } from "./storefront.functions";

export const publicShopQuery = (slug: string) =>
  queryOptions({ queryKey: ["publicShop", slug], queryFn: () => getPublicShop({ data: { slug } }), staleTime: 60_000 });

export type PublicShopData = Awaited<ReturnType<typeof getPublicShop>>;
