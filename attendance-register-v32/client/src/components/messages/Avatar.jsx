import clsx from 'clsx';
import { initials } from '../../utils/messagingRoles.js';

export default function Avatar({ account, size = 'md', className }) {
  const dimensions = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-sm';
  return (
    <span aria-hidden="true" className={clsx('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light font-semibold text-accent', dimensions, className)}>
      {account?.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(account)}
    </span>
  );
}
