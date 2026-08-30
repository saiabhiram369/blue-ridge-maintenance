import { CheckCircle2, ClipboardList, Sparkles, Wrench } from 'lucide-react';
import type { WorkOrder } from '../types';

interface Props {
  technician: string;
  orders: WorkOrder[];
}

export function TechnicianHero({ technician, orders }: Props) {
  const active = orders.filter(order => order.status === 'In Progress').length;
  const waiting = orders.filter(order => order.status === 'Pending Tiffany').length;
  const done = orders.filter(order => order.status === 'Resolved').length;

  return (
    <section className="tech-3d-hero">
      <div className="tech-3d-copy">
        <span className="tech-hero-kicker"><Sparkles size={14}/> FIELD WORKSPACE</span>
        <h2>Make the work visible.</h2>
        <p>
          {technician}, this workspace is built around your assigned jobs. Finish the physical work,
          mark it done, and Tiffany handles final verification.
        </p>

        <div className="tech-hero-stats">
          <div><Wrench size={16}/><strong>{active}</strong><span>in progress</span></div>
          <div><ClipboardList size={16}/><strong>{waiting}</strong><span>awaiting Tiffany</span></div>
          <div><CheckCircle2 size={16}/><strong>{done}</strong><span>verified</span></div>
        </div>
      </div>

      <div className="tech-scene" aria-hidden="true">
        <div className="scene-orbit orbit-one"><span/></div>
        <div className="scene-orbit orbit-two"><span/></div>
        <div className="scene-card scene-card-a"><Wrench size={28}/><small>WORK</small></div>
        <div className="scene-card scene-card-b"><CheckCircle2 size={28}/><small>DONE</small></div>
        <div className="scene-card scene-card-c"><ClipboardList size={24}/><small>VERIFY</small></div>
        <div className="scene-core">
          <div className="scene-mountain"><i/><i/><i/></div>
        </div>
      </div>
    </section>
  );
}
