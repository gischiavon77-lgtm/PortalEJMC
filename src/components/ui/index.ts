/**
 * Barrel de re-exports do pacote `components/ui`.
 *
 * Permite imports concisos como:
 *   import { Button, Card, Input } from '@/components/ui';
 *
 * Re-exportamos os tipos públicos junto com os componentes para
 * facilitar o consumo em forms e páginas.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';

export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card';
export type { CardPadding, CardProps, CardVariant } from './Card';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

export { DataTable } from './DataTable';
export type { Column, DataTableProps } from './DataTable';

export { Badge } from './Badge';
export type { BadgeProps, BadgeSize, BadgeVariant } from './Badge';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';
