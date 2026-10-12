import { motion } from 'framer-motion';

const accents = {
  violet: ['#6658cf', '#f1efff'],
  blue: ['#1685ca', '#eaf6ff'],
  green: ['#0d9a75', '#e7f8f1'],
  orange: ['#eb8247', '#fff1e7'],
};

export default function KpiCard({ icon, label, value, caption, tone = 'violet', index = 0 }) {
  const [accent, pale] = accents[tone] || accents.violet;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.08 }}
      whileHover={{ y: -5, boxShadow: '0 18px 44px rgba(30,40,80,.12)' }}
      className="tv-kpi h-100"
      style={{ '--accent': accent, '--accent-pale': pale }}
    >
      <div className="tv-kpi-top">
        <span className="tv-kpi-label">{label}</span>
        <span className="tv-kpi-icon"><i className={`bi ${icon}`} /></span>
      </div>
      <div className="tv-kpi-value" title={String(value)}>{value}</div>
      {caption && <div className="tv-kpi-caption">{caption}</div>}
    </motion.div>
  );
}
