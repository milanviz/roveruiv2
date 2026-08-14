// src/utils/streamingController.ts

let currentController: AbortController | null = null;

export const setCurrentController = (controller: AbortController | null) => {
    currentController = controller;
};

export const getCurrentController = () => currentController;
