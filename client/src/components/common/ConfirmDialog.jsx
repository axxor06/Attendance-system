import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', isLoading, variant = 'danger' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-slate leading-relaxed">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
