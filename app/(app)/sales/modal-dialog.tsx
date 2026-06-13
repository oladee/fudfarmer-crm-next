'use client';

type ModalDialogProps = {
  onClose: () => void;
  children: React.ReactNode;
  align?: 'center' | 'end';
};

export function ModalDialog({
  onClose,
  children,
  align = 'center',
}: Readonly<ModalDialogProps>) {
  const layoutClass = align === 'end'
    ? 'open:flex justify-end'
    : 'open:flex items-center justify-center p-4';

  return (
    <dialog
      open
      className={`fixed inset-0 z-50 m-0 max-w-none max-h-none w-full h-full border-0 p-0 bg-transparent ${layoutClass}`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full bg-background/80 backdrop-blur-sm border-0 p-0 cursor-default"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      {children}
    </dialog>
  );
}
