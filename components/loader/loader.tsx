"use client";

import { useEffect, useRef } from "react";
import styles from "./loader.module.css";

const ChatLoader = () => {
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!textRef.current) return;

        const text = textRef.current.innerText.trim();
        textRef.current.innerHTML = text
            .split("")
            .map((char) => `<span>${char}</span>`)
            .join("");
    }, []);

    return (
        <div className={styles.wrapper}>
            <div ref={textRef} className={styles.content}>
                Thinking...
            </div>
        </div>
    );
};

export default ChatLoader;
