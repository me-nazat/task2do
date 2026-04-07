import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface AlertBannerProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  colorScheme?: 'red' | 'amber' | 'green' | 'blue';
  children?: ReactNode;
}

export function AlertBanner({ title, subtitle, icon: Icon, colorScheme = 'red', children }: AlertBannerProps) {
  const colorMap = {
    red: {
      border: 'border-red-200/40',
      gradient: 'from-red-50/80 via-rose-50/40 to-orange-50/30',
      blob1: 'from-red-200/20',
      blob2: 'from-orange-200/20',
      iconBg: 'from-red-400 to-rose-500',
      iconColor: 'text-white',
      titleColor: 'text-red-900',
      subtitleColor: 'text-red-600/70',
    },
    amber: {
      border: 'border-amber-200/40',
      gradient: 'from-amber-50/80 via-orange-50/40 to-yellow-50/30',
      blob1: 'from-amber-200/20',
      blob2: 'from-yellow-200/20',
      iconBg: 'from-amber-400 to-orange-500',
      iconColor: 'text-white',
      titleColor: 'text-amber-900',
      subtitleColor: 'text-amber-600/70',
    },
    green: {
      border: 'border-green-200/40',
      gradient: 'from-green-50/80 via-emerald-50/40 to-teal-50/30',
      blob1: 'from-green-200/20',
      blob2: 'from-teal-200/20',
      iconBg: 'from-green-400 to-emerald-500',
      iconColor: 'text-white',
      titleColor: 'text-green-900',
      subtitleColor: 'text-green-600/70',
    },
    blue: {
      border: 'border-blue-200/40',
      gradient: 'from-blue-50/80 via-indigo-50/40 to-cyan-50/30',
      blob1: 'from-blue-200/20',
      blob2: 'from-cyan-200/20',
      iconBg: 'from-blue-400 to-indigo-500',
      iconColor: 'text-white',
      titleColor: 'text-blue-900',
      subtitleColor: 'text-blue-600/70',
    },
  };

  const scheme = colorMap[colorScheme];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 300 }}
      className={cn("relative overflow-hidden rounded-2xl border shadow-lg", scheme.border, `bg-gradient-to-br ${scheme.gradient}`)}
    >
      <div className={cn("absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl bg-gradient-to-bl", scheme.blob1, "to-transparent")} />
      <div className={cn("absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl bg-gradient-to-tr", scheme.blob2, "to-transparent")} />
      
      <div className="relative p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-3 sm:mb-6">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br", scheme.iconBg)}>
            <Icon className={cn("w-5 h-5", scheme.iconColor)} />
          </div>
          <div>
            <h3 className={cn("font-headline font-medium text-base sm:text-lg lg:text-xl tracking-tight italic", scheme.titleColor)}>
              {title}
            </h3>
            {subtitle && (
              <p className={cn("text-[8px] font-label font-bold tracking-[0.25em] uppercase", scheme.subtitleColor)}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {children && (
          <div className="space-y-2">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}
