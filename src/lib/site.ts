/** Dados públicos do site. Tudo que identifica a empresa vem de variáveis de ambiente. */
export const site = {
  name: "VIVA AI",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  company: process.env.NEXT_PUBLIC_EMPRESA_NOME?.trim() || null,
  companyId: process.env.NEXT_PUBLIC_EMPRESA_CNPJ?.trim() || null,
  contactEmail: process.env.NEXT_PUBLIC_CONTATO_EMAIL?.trim() || null,
};
