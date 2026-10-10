import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Store, Package, DollarSign, ArrowRight, TrendingUp, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

async function count(table: "profiles" | "shops" | "products" | "orders") {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

type FilterType = "7_days" | "30_days" | "7_months";

function getPastPeriods(type: FilterType) {
  const monthsStr = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aou", "Sep", "Oct", "Nov", "Dec"];
  const result = [];
  const d = new Date();
  
  if (type === "7_months") {
    for (let i = 6; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      result.push({ label: monthsStr[past.getMonth()], match: (date: Date) => date.getMonth() === past.getMonth() && date.getFullYear() === past.getFullYear() });
    }
  } else {
    const days = type === "7_days" ? 7 : 14;
    for (let i = days - 1; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
      result.push({ label: `${past.getDate()} ${monthsStr[past.getMonth()]}`.slice(0, 6), match: (date: Date) => date.getDate() === past.getDate() && date.getMonth() === past.getMonth() && date.getFullYear() === past.getFullYear() });
    }
  }
  return result;
}

function AdminHome() {
  const [revenueFilter, setRevenueFilter] = useState<FilterType>("7_months");
  const [merchantFilter, setMerchantFilter] = useState<FilterType>("7_days");

  const { data, isLoading } = useQuery({
    queryKey: ["adminStats", revenueFilter, merchantFilter],
    queryFn: async () => {
      const [m, s, p, o] = await Promise.all([count("profiles"), count("shops"), count("products"), count("orders")]);
      
      const { data: pays } = await supabase.from("subscription_payments").select("amount,status,created_at");
      const { data: profilesData } = await supabase.from("profiles").select("created_at");
      
      const approvedPays = (pays ?? []).filter((x) => x.status === "approved");
      const revenue = approvedPays.reduce((a, b) => a + Number(b.amount), 0);
      const allProfiles = profilesData ?? [];

      const revenuePeriods = getPastPeriods(revenueFilter);
      const revenueData = revenuePeriods.map(period => {
        const total = approvedPays.filter(p => period.match(new Date(p.created_at))).reduce((a, b) => a + Number(b.amount), 0);
        return { label: period.label, value: total };
      });

      const merchantPeriods = getPastPeriods(merchantFilter);
      const merchantsData = merchantPeriods.map(period => {
        const total = allProfiles.filter(p => period.match(new Date(p.created_at))).length;
        return { label: period.label, value: total };
      });

      return { m, s, p, o, revenue, revenueData, merchantsData };
    },
  });

  const stats = [
    { label: "Commercants", value: data?.m, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: "Boutiques Actives", value: data?.s, icon: Store, color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { label: "Produits en ligne", value: data?.p, icon: Package, color: "text-pink-600", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    { label: "Revenus (Approuves)", value: data ? `${data.revenue} $` : undefined, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20", trend: "+12%" },
  ];

  const filterLabels = {
    "7_days": "7 jours",
    "30_days": "14 jours",
    "7_months": "7 mois"
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-muted-foreground">Voici l'etat actuel de votre plateforme MarketNet aujourd'hui.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="rounded-xl h-11 bg-background shadow-sm">
            <Link to="/admin/parametres">Parametres</Link>
          </Button>
          <Button asChild className="rounded-xl h-11 shadow-sm">
            <Link to="/admin/boutiques">Gerer les boutiques <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-transparent to-${stat.color.split('-')[1]}-500/10 rounded-bl-full -z-10`} />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center border ${stat.bg} ${stat.color} ${stat.border}`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                {stat.trend && <div className="self-start sm:self-auto flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full"><TrendingUp className="h-3 w-3" /> {stat.trend}</div>}
              </div>
              <div>
                {isLoading ? (
                  <div className="h-6 sm:h-8 w-12 sm:w-16 bg-muted rounded animate-pulse mb-1"></div>
                ) : (
                  <p className="text-xl sm:text-3xl font-black text-foreground">{stat.value}</p>
                )}
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1 truncate">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* REVENUE CHART */}
        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" /> Evolution Revenus</h2>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 gap-2 text-xs sm:text-sm bg-muted/50 border-muted">
                  <Calendar className="h-4 w-4" /> {filterLabels[revenueFilter]} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRevenueFilter("7_days")}>7 derniers jours</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRevenueFilter("30_days")}>14 derniers jours</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRevenueFilter("7_months")}>7 derniers mois</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-52 w-full relative">
            {isLoading ? (
              <div className="w-full h-full bg-muted/20 animate-pulse rounded-xl"></div>
            ) : (
              <div className="w-full h-full flex items-end justify-between gap-1 sm:gap-2 pt-4 relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-full border-t border-dashed border-muted/50 h-0" />
                  ))}
                </div>
                {data?.revenueData.map((d, i) => {
                  const maxVal = Math.max(...(data.revenueData.map(x => x.value || 1)));
                  const heightPercentage = Math.max((d.value / maxVal) * 100, 5);
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center group h-full relative z-10">
                      <div className="absolute -top-8 bg-foreground text-background text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {d.value.toFixed(2)} $
                      </div>
                      <div 
                        className="w-full max-w-[32px] bg-emerald-500/20 hover:bg-emerald-500 transition-all rounded-t-sm border-t border-emerald-500/50 relative overflow-hidden"
                        style={{ height: `${heightPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-emerald-500/30" />
                      </div>
                      <div className="mt-2 text-[8px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate w-full text-center">
                        {revenueFilter === "7_months" ? d.label : d.label.split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MERCHANTS CHART */}
        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /> Inscriptions</h2>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 gap-2 text-xs sm:text-sm bg-muted/50 border-muted">
                  <Calendar className="h-4 w-4" /> {filterLabels[merchantFilter]} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMerchantFilter("7_days")}>7 derniers jours</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMerchantFilter("30_days")}>14 derniers jours</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMerchantFilter("7_months")}>7 derniers mois</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-52 w-full relative">
            {isLoading ? (
              <div className="w-full h-full bg-muted/20 animate-pulse rounded-xl"></div>
            ) : (
              <div className="w-full h-full relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-full border-t border-dashed border-muted/50 h-0" />
                  ))}
                </div>
                
                {/* SVG Line Chart */}
                <div className="absolute inset-0 pb-6 flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {data?.merchantsData && (
                      <path
                        d={(() => {
                          const maxVal = Math.max(...(data.merchantsData.map(x => x.value || 1)));
                          const count = data.merchantsData.length;
                          let path = '';
                          data.merchantsData.forEach((d, i) => {
                            const x = (i / (count - 1)) * 100;
                            const y = 100 - (d.value / maxVal) * 100;
                            if (i === 0) path += `M ${x} ${y} `;
                            else path += `L ${x} ${y} `;
                          });
                          return path;
                        })()}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-blue-500 drop-shadow-sm"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                  
                  {data?.merchantsData.map((d, i) => {
                    const maxVal = Math.max(...(data.merchantsData.map(x => x.value || 1)));
                    const y = 100 - (d.value / maxVal) * 100;
                    const count = data.merchantsData.length;
                    
                    return (
                      <div key={i} className="absolute flex-col items-center group cursor-pointer" style={{ left: `${(i / (count - 1)) * 100}%`, bottom: `${100 - y}%`, transform: 'translate(-50%, 50%)' }}>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                          {d.value}
                        </div>
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-card border-2 border-blue-500 rounded-full group-hover:scale-150 group-hover:bg-blue-500 transition-transform relative z-10" />
                      </div>
                    );
                  })}
                </div>
                
                {/* Labels */}
                <div className="absolute bottom-0 inset-x-0 h-4 flex justify-between">
                  {data?.merchantsData.map((d, i) => (
                    <div key={i} className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center" style={{ width: '30px', transform: 'translateX(-50%)', marginLeft: i === 0 ? '15px' : i === data.merchantsData.length - 1 ? '-15px' : '0' }}>
                      {merchantFilter === "7_months" ? d.label : d.label.split(" ")[0]}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
