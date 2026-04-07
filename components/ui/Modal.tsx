'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, contentClassName }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md animate-in fade-in duration-300" />
        <Dialog.Content className={cn(
          "fixed z-50 overflow-y-auto bg-white shadow-2xl animate-in duration-300",
          "inset-x-0 bottom-0 max-h-[88svh] min-h-[52svh] rounded-t-[2rem] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-5",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:min-h-0 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-8 sm:max-h-[85vh]",
          /* Animations */
          "max-sm:mobile-bottom-sheet sm:zoom-in-95 sm:slide-in-from-bottom-10",
          contentClassName
        )}>
          <div className="mb-6 flex items-center justify-between sm:mb-8">
            {/* Drag handle for mobile */}
            <div className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-outline-variant/40 sm:hidden" />
            <Dialog.Title className="mt-2 pr-10 text-lg font-headline font-medium italic text-primary sm:mt-0 sm:text-2xl">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="touch-target flex items-center justify-center rounded-full p-2 text-outline/60 transition-colors active:scale-95 active:bg-primary/5 lg:hover:bg-primary/5">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
