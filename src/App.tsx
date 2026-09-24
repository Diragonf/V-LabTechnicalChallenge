import { useState } from 'react';
import { DashboardSummary } from './components/DashboardSummary.tsx';
import { SolicitacoesList } from './components/SolicitacoesList.tsx';
import { SolicitacaoForm } from './components/SolicitacaoForm.tsx';
import { SolicitacaoDetailsModal } from './components/SolicitacaoDetailsModal.tsx';
import './global.css';

export default function App() {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const refresh = () => setRevision((value) => value + 1);
  return <>
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <header className="app-header"><a className="brand" href="#main" aria-label="V-Lab, início"><span className="brand-mark" aria-hidden="true">+</span><strong>V-Lab<span>Saúde pública</span></strong></a><span className="demo-badge">Ambiente de demonstração</span></header>
    <main id="main" className="app-main">
      <div className="page-heading"><div><p className="page-kicker">Central de atendimento</p><h1>Cuidar começa com escutar.</h1><p>Acompanhe e organize as solicitações de saúde em um só lugar.</p></div><a className="new-link" href="#new-request">+ Nova solicitação</a></div>
      <DashboardSummary refreshKey={revision} />
      <SolicitacoesList refreshKey={revision} onSelect={setSelected} />
      <div id="new-request"><SolicitacaoForm onCreated={refresh} /></div>
      <footer className="app-footer"><span>V-Lab · Gestão de solicitações</span><span>Todos os dados deste ambiente devem ser fictícios.</span></footer>
    </main>
    {selected !== null && <SolicitacaoDetailsModal key={selected} id={selected} onClose={() => setSelected(null)} onUpdated={refresh} />}
  </>;
}
