'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { apiFetch } from '../lib/apiClient';
import { getWorkerApiBaseUrl } from '../lib/apiConfig';
import type { ProjectCreateInput } from '../types/project.types';

type RecordingStatus = 'idle' | 'recording' | 'processing';

const MAX_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface ParsedOnboardingResponse {
  transcript: string;
  projects: ProjectCreateInput[];
}

export function useOnboardingRecording() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [microphoneAvailable, setMicrophoneAvailable] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);

  const parseProjectsMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      const response = await apiFetch(`${getWorkerApiBaseUrl()}/ai/parse-onboarding`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || 'Failed to parse onboarding projects');
      }
      return (await response.json()) as ParsedOnboardingResponse;
    },
    onSuccess: () => {
      setStatus('idle');
    },
    onError: (error) => {
      notifications.show({
        title: 'Parsing Failed',
        message: error.message,
        color: 'red',
      });
      setStatus('idle');
    },
  });

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });

      streamRef.current = stream;
      setMicrophoneAvailable(true);

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const alternatives = ['audio/mp4', 'audio/wav', 'audio/ogg'];
        const supported = alternatives.find((type) => MediaRecorder.isTypeSupported(type));
        mimeType = supported || '';
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mimeTypeRef.current = mimeType;
      audioChunksRef.current = [];
      let currentSize = 0;

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          currentSize += event.data.size;
          if (currentSize > MAX_FILE_SIZE_BYTES) {
            stopRecording();
            notifications.show({
              title: 'Recording Stopped',
              message: 'Maximum file size of 10MB reached.',
              color: 'orange',
            });
          }
        }
      };

      mediaRecorderRef.current.onstop = () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        // Stop all tracks to release the microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current,
        });

        const formData = new FormData();
        formData.append('audio', audioBlob, 'onboarding.webm');

        setStatus('processing');
        parseProjectsMutation.mutate(formData);
      };

      mediaRecorderRef.current.start(1000);
      setStatus('recording');

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
        notifications.show({
          title: 'Recording Stopped',
          message: 'Maximum duration of 3 minutes reached.',
          color: 'orange',
        });
      }, MAX_DURATION_MS);
    } catch (_error) {
      setMicrophoneAvailable(false);
      notifications.show({
        title: 'Microphone Error',
        message: 'Could not access the microphone. Please check permissions.',
        color: 'red',
      });
    }
  };

  return {
    status,
    microphoneAvailable,
    parsedProjects: parseProjectsMutation.data?.projects || null,
    transcript: parseProjectsMutation.data?.transcript || null,
    startRecording,
    stopRecording,
    isProcessing: parseProjectsMutation.isPending,
  };
}
