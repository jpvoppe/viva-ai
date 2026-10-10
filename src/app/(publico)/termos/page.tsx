import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Pending } from "@/components/legal/legal-page";
import { MIN_AGE } from "@/features/auth/schema";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras de uso do VIVA AI: o que o serviço faz, o que não faz, planos, cancelamento e responsabilidades.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  const company = site.company ?? <Pending>razão social a ser informada antes do lançamento</Pending>;
  const contact = site.contactEmail ? (
    <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
  ) : (
    <Pending>e-mail de contato a ser informado antes do lançamento</Pending>
  );

  return (
    <LegalPage title="Termos de uso" updated="10 de outubro de 2026">
      <section>
        <p>
          Estes termos valem entre você e {company}, responsável pelo VIVA AI. Ao criar uma conta, você declara que
          leu e concorda com eles e com a <Link href="/privacidade">Política de privacidade</Link>.
        </p>
      </section>

      <section>
        <h2>O que é o VIVA</h2>
        <p>
          Um assistente pessoal com inteligência artificial e ferramentas de organização: conversa, tarefas, listas,
          objetivos, projetos, criação de textos e estudo.
        </p>
        <p>
          <strong>O VIVA pode errar.</strong> As respostas são geradas automaticamente, podem estar incompletas,
          desatualizadas ou incorretas, e não substituem a orientação de profissionais de saúde, direito, finanças ou
          de qualquer outra área. Confira informações importantes antes de agir. Não garantimos resultados (notas,
          aprovações, ganhos ou economia).
        </p>
      </section>

      <section>
        <h2>Quem pode usar</h2>
        <ul>
          <li>Pessoas a partir de {MIN_AGE} anos. A idade é declarada por você no cadastro.</li>
          <li>De {MIN_AGE} a 17 anos, o uso deve ter o conhecimento de um responsável, e planos pagos só podem ser contratados por maiores de 18.</li>
          <li>Cada conta é pessoal. Guarde a sua senha e avise-nos se suspeitar de acesso indevido.</li>
        </ul>
      </section>

      <section>
        <h2>Uso aceitável</h2>
        <p>Você concorda em não usar o VIVA para:</p>
        <ul>
          <li>atividades ilegais, assédio, ameaças, discurso de ódio ou exploração de menores;</li>
          <li>gerar conteúdo que viole direitos de terceiros ou enganar pessoas (fraudes, desinformação deliberada);</li>
          <li>tentar burlar limites, acessar dados de outras contas ou sobrecarregar o serviço de forma automatizada;</li>
          <li>enviar arquivos com vírus ou conteúdo que você não tem direito de compartilhar.</li>
        </ul>
        <p>Podemos suspender contas que descumpram estas regras, avisando o motivo sempre que possível.</p>
      </section>

      <section>
        <h2>Seu conteúdo</h2>
        <p>
          O que você escreve e envia continua sendo seu. Você nos autoriza a armazenar e processar esse conteúdo
          somente para prestar o serviço a você. Os textos gerados pela IA a seu pedido podem ser usados por você
          livremente; como sistemas de IA podem produzir resultados parecidos para pessoas diferentes, não garantimos
          exclusividade nem originalidade.
        </p>
      </section>

      <section>
        <h2>Planos, limites e pagamento</h2>
        <ul>
          <li>O plano Gratuito tem limites diários informados na página <Link href="/planos">Planos</Link>. Os limites podem ser ajustados; mudanças que reduzam um plano pago em vigor só valem a partir da renovação seguinte.</li>
          <li>Planos pagos são assinaturas com renovação automática, cobradas pelo processador de pagamentos no período contratado.</li>
          <li>Você cancela quando quiser, em Configurações, Assinatura. O acesso continua até o fim do período já pago; não há multa.</li>
          <li>Em compras feitas pela internet, você pode desistir em até 7 dias da contratação, com devolução do valor pago, nos termos do Código de Defesa do Consumidor.</li>
          <li>Se um pagamento falhar, avisamos no app e tentamos novamente; sem regularização, a conta volta ao plano Gratuito, sem perda dos seus dados.</li>
        </ul>
      </section>

      <section>
        <h2>Disponibilidade</h2>
        <p>
          Trabalhamos para manter o VIVA no ar, mas o serviço depende de fornecedores (como o provedor de IA) e pode
          ficar instável ou indisponível por períodos. Recursos podem mudar ou ser descontinuados; quando isso afetar
          um plano pago, avisaremos com antecedência.
        </p>
      </section>

      <section>
        <h2>Responsabilidade</h2>
        <p>
          Respondemos pelos danos que causarmos nos limites da lei. Não respondemos por decisões tomadas apenas com
          base nas respostas da IA, nem por conteúdo que você mesmo inseriu ou compartilhou. Nada nestes termos reduz
          direitos que a legislação brasileira de defesa do consumidor garante a você.
        </p>
      </section>

      <section>
        <h2>Encerramento</h2>
        <p>
          Você pode excluir a sua conta a qualquer momento, em Configurações, Privacidade. A exclusão apaga os seus
          dados conforme a <Link href="/privacidade">Política de privacidade</Link>.
        </p>
      </section>

      <section>
        <h2>Mudanças e contato</h2>
        <p>
          Se estes termos mudarem de forma relevante, avisaremos dentro do app antes de a mudança valer. Dúvidas:{" "}
          {contact}. Estes termos seguem a legislação brasileira.
        </p>
      </section>
    </LegalPage>
  );
}
