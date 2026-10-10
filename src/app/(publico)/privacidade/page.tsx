import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Pending } from "@/components/legal/legal-page";
import { MIN_AGE } from "@/features/auth/schema";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o VIVA AI trata, para quê, com quem compartilha e como você exerce os seus direitos (LGPD).",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  const company = site.company ?? <Pending>razão social a ser informada antes do lançamento</Pending>;
  const contact = site.contactEmail ? (
    <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
  ) : (
    <Pending>e-mail de contato a ser informado antes do lançamento</Pending>
  );

  return (
    <LegalPage title="Política de privacidade" updated="10 de outubro de 2026">
      <section>
        <p>
          Esta política explica, em linguagem direta, como o VIVA AI trata os seus dados pessoais, de acordo com a Lei
          Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).
        </p>
        <p>
          <strong>Quem é o responsável (controlador):</strong> {company}
          {site.companyId ? `, CNPJ ${site.companyId}` : ""}. <strong>Contato para assuntos de privacidade:</strong>{" "}
          {contact}.
        </p>
      </section>

      <section>
        <h2>Quais dados tratamos</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> nome de tratamento, e-mail e senha (a senha é guardada de forma cifrada pelo
            serviço de autenticação; ninguém da equipe consegue lê-la).
          </li>
          <li>
            <strong>Faixa etária:</strong> pedimos a data de nascimento no cadastro apenas para calcular se você é
            adulto ou adolescente. Guardamos só essa faixa; a data não é armazenada.
          </li>
          <li>
            <strong>O que você cria:</strong> conversas, arquivos enviados, tarefas, listas, objetivos, projetos,
            cartões de estudo, questionários e textos salvos.
          </li>
          <li>
            <strong>Preferências:</strong> tema, estilo de resposta, objetivos escolhidos, fuso horário e, se você
            ativar, os itens da memória personalizada.
          </li>
          <li>
            <strong>Uso:</strong> contadores de mensagens, criações e arquivos por dia; quantidade de tokens e custo
            estimado de cada chamada de IA; registros de atividade (por exemplo, “tarefa concluída”) usados para o
            seu progresso.
          </li>
          <li>
            <strong>Assinatura:</strong> plano, situação e identificadores da cobrança. Os dados do cartão ficam com
            o processador de pagamentos; o VIVA não os recebe nem armazena.
          </li>
          <li>
            <strong>Segurança:</strong> para limitar abusos, calculamos um código irreversível (hash) a partir do
            endereço IP nas telas de entrada. Registros de erro técnico não incluem o conteúdo das suas conversas.
          </li>
        </ul>
        <p>
          Não pedimos documentos, endereço ou dados sensíveis. Evite incluí-los nas conversas. A memória personalizada
          recusa conteúdo que pareça CPF, cartão ou senha.
        </p>
      </section>

      <section>
        <h2>Para que usamos e com qual base legal</h2>
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (criar a conta, responder às mensagens, guardar o que você cria,
            aplicar os limites do plano): execução de contrato.
          </li>
          <li>
            <strong>Cobrança e obrigações fiscais:</strong> execução de contrato e cumprimento de obrigação legal.
          </li>
          <li>
            <strong>Segurança e prevenção de abuso</strong> (limite de requisições, registros de erro): legítimo
            interesse.
          </li>
          <li>
            <strong>Memória personalizada:</strong> consentimento. Vem desligada e você pode desligar ou apagar a
            qualquer momento.
          </li>
          <li>
            <strong>Melhoria do produto:</strong> usamos números agregados (por exemplo, quantas pessoas usaram um
            recurso). A equipe não lê as suas conversas para isso.
          </li>
        </ul>
        <p>Não vendemos dados pessoais e não usamos os seus dados para publicidade de terceiros.</p>
      </section>

      <section>
        <h2>Inteligência artificial</h2>
        <p>
          Para responder, o VIVA envia ao provedor de IA contratado o texto da sua mensagem, os anexos daquela
          mensagem, um trecho recente da conversa e, se estiverem ativos, os itens da sua memória e os dados do
          projeto ligado à conversa. O provedor trata esses dados como operador, para gerar a resposta.
        </p>
        <p>
          As respostas são geradas automaticamente e podem conter erros. Não use o VIVA como única fonte para decisões
          de saúde, jurídicas ou financeiras.
        </p>
        <p>
          <strong>Ditado por voz:</strong> quando você usa o botão de microfone, a transcrição é feita pelo recurso de
          reconhecimento de fala do seu navegador, que pode enviar o áudio ao fornecedor do navegador. O VIVA recebe
          apenas o texto transcrito.
        </p>
      </section>

      <section>
        <h2>Com quem compartilhamos</h2>
        <p>Apenas com empresas que operam partes do serviço, na medida necessária:</p>
        <ul>
          <li>Banco de dados, autenticação e armazenamento de arquivos (Supabase).</li>
          <li>Provedor de inteligência artificial (processa o conteúdo das mensagens para gerar respostas).</li>
          <li>Processador de pagamentos (Stripe), quando há assinatura.</li>
          <li>Hospedagem da aplicação.</li>
        </ul>
        <p>
          Alguns desses fornecedores processam dados fora do Brasil. Nesses casos, a transferência internacional segue
          as garantias previstas na LGPD. Também podemos compartilhar dados quando houver obrigação legal ou ordem de
          autoridade competente.
        </p>
      </section>

      <section>
        <h2>Por quanto tempo guardamos</h2>
        <ul>
          <li>Seus dados ficam guardados enquanto a conta existir, ou até você apagar cada item.</li>
          <li>Ao excluir a conta, apagamos conversas, arquivos, tarefas, projetos, memória e preferências.</li>
          <li>
            Registros de consumo de IA e de cobrança são desvinculados da conta excluída e podem ser mantidos pelo
            prazo exigido por lei.
          </li>
          <li>Cópias de segurança são sobrescritas conforme o ciclo do fornecedor de banco de dados.</li>
        </ul>
      </section>

      <section>
        <h2>Seus direitos</h2>
        <p>Pela LGPD, você pode, a qualquer momento:</p>
        <ul>
          <li>
            <strong>Acessar e levar seus dados:</strong> em Configurações, Privacidade, “Baixar meus dados”.
          </li>
          <li>
            <strong>Corrigir:</strong> edite o nome, as preferências e qualquer conteúdo seu dentro do app.
          </li>
          <li>
            <strong>Apagar:</strong> exclua conversas, itens de memória ou a conta inteira, sem precisar pedir a
            ninguém.
          </li>
          <li>
            <strong>Revogar consentimento:</strong> desligue a memória personalizada em Configurações.
          </li>
          <li>
            <strong>Tirar dúvidas ou reclamar:</strong> escreva para {contact}. Você também pode procurar a Autoridade
            Nacional de Proteção de Dados (ANPD).
          </li>
        </ul>
      </section>

      <section>
        <h2>Crianças e adolescentes</h2>
        <p>
          O VIVA não é destinado a menores de {MIN_AGE} anos e não cria contas para essa faixa. Para adolescentes de{" "}
          {MIN_AGE} a 17 anos, o assistente recebe instruções adicionais de adequação de conteúdo, a memória vem
          desligada e a contratação de planos pagos não é permitida. Recomendamos que os responsáveis acompanhem o uso.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Usamos apenas cookies necessários para manter você conectado. O tema escolhido e o estado do menu ficam
          guardados no seu próprio navegador. Não usamos cookies de publicidade.
        </p>
      </section>

      <section>
        <h2>Segurança</h2>
        <p>
          Cada conta só acessa as próprias linhas no banco de dados, por regras aplicadas no próprio banco. As chaves
          dos fornecedores ficam somente no servidor. Nenhum sistema é infalível; se houver incidente relevante com os
          seus dados, você e a ANPD serão comunicados nos termos da lei.
        </p>
      </section>

      <section>
        <h2>Mudanças nesta política</h2>
        <p>
          Se algo importante mudar, avisaremos dentro do app antes de a mudança valer. Veja também os{" "}
          <Link href="/termos">Termos de uso</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
