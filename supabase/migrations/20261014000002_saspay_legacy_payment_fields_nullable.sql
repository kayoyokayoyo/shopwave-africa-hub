-- Les anciens paiements manuels imposaient ces champs, mais le flux SasPay
-- utilise maintenant montant_usd/montant_cdf, methode et saspay_session_id.
-- Les anciennes colonnes restent disponibles pour les enregistrements historiques.
alter table public.subscription_payments
  alter column amount drop not null,
  alter column method drop not null,
  alter column reference drop not null;
