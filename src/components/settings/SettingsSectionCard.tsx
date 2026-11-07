import React from "react";

export interface SettingsSectionCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  accentColorClass?: string;
  iconBgClass?: string;
  iconColorClass?: string;
  children: React.ReactNode;
}

export const SettingsSectionCard: React.FC<SettingsSectionCardProps> = ({
  icon,
  title,
  description,
  accentColorClass = "bg-primary/5",
  iconBgClass = "bg-primary/10",
  iconColorClass = "text-primary",
  children,
}) => {
  return (
    <div className="bg-card rounded-xl p-4 shadow-xs relative overflow-hidden">
      <div className={`absolute top-0 end-0 w-32 h-32 rounded-bl-full pointer-events-none -me-4 -mt-4 ${accentColorClass}`} />
      <div className="flex items-start gap-3 relative z-10">
        <div className={`p-2 rounded-lg shrink-0 ${iconBgClass}`}>
          <div className={iconColorClass}>
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
