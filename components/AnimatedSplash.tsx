'use no memo'; // Prevents React Compiler from conflicting with Reanimated hooks

import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const LOGO_SIZE = width * 0.38;
const RING_SIZE = LOGO_SIZE * 1.5;

// 12 fixed starburst particles
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * Math.PI * 2,
    dist: i % 2 === 0 ? 95 : 120,
    size: i % 3 === 0 ? 9 : i % 3 === 1 ? 6 : 4,
}));

interface Props {
    onFinished: () => void;
}

// ── Sonar Ring ──────────────────────────────────────────────────────────────
function Ring({ delay }: { delay: number }) {
    const prog = useSharedValue(0);

    useEffect(() => {
        prog.value = withDelay(
            delay,
            withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: Math.max(0, 1 - prog.value) * 0.45,
        transform: [{ scale: 0.15 + prog.value * 2.8 }],
    }));

    return <Animated.View style={[styles.ring, style]} />;
}

// ── Starburst Particle ──────────────────────────────────────────────────────
function Particle({
    angle, dist, size, delay,
}: (typeof PARTICLES)[number] & { delay: number }) {
    const prog = useSharedValue(0);

    useEffect(() => {
        prog.value = withDelay(
            delay,
            withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }),
        );
    }, []);

    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    const style = useAnimatedStyle(() => ({
        opacity:
            prog.value < 0.4
                ? prog.value / 0.4
                : 1 - (prog.value - 0.4) / 0.6,
        transform: [
            { translateX: tx * prog.value },
            { translateY: ty * prog.value },
            { scale: 1.2 - prog.value * 0.4 },
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.particle,
                { width: size, height: size, borderRadius: size / 2 },
                style,
            ]}
        />
    );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function AnimatedSplash({ onFinished }: Props) {
    const logoOpacity = useSharedValue(0);
    const logoScale = useSharedValue(0.05);
    const logoY = useSharedValue(-70);
    const logoRotate = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const glowScale = useSharedValue(0.5);
    const containerOp = useSharedValue(1);
    const containerSc = useSharedValue(1);
    const flashOp = useSharedValue(0);

    useEffect(() => {
        // Logo drop-in with spring physics ─────────────── t = 300ms
        logoOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
        logoY.value = withDelay(300, withSpring(0, { damping: 11, stiffness: 130, mass: 0.9 }));
        logoScale.value = withDelay(300, withSequence(
            withSpring(1, { damping: 7, stiffness: 105, mass: 0.8 }),
            // Final pulse fires after spring settles (~650ms) + 750ms wait
            withDelay(750, withSequence(
                withSpring(1.12, { damping: 5, stiffness: 350, mass: 0.4 }),
                withSpring(1.0, { damping: 12, stiffness: 200 }),
            )),
        ));

        // Wobble on landing (weighted feel) ────────────── t ≈ 950ms
        logoRotate.value = withDelay(950, withSequence(
            withTiming(10, { duration: 90, easing: Easing.out(Easing.quad) }),
            withTiming(-7, { duration: 100 }),
            withTiming(4, { duration: 80 }),
            withTiming(-2, { duration: 70 }),
            withTiming(0, { duration: 70 }),
        ));

        // Glow burst from behind logo ───────────────────── t ≈ 1000ms
        glowOpacity.value = withDelay(1000, withSequence(
            withTiming(0.85, { duration: 120 }),
            withTiming(0, { duration: 550, easing: Easing.out(Easing.cubic) }),
        ));
        glowScale.value = withDelay(1000,
            withTiming(2.5, { duration: 670, easing: Easing.out(Easing.cubic) }),
        );

        // White flash ──────────────────────────────────── t ≈ 2000ms
        flashOp.value = withDelay(2000, withSequence(
            withTiming(1, { duration: 100 }),
            withTiming(0, { duration: 100 }),
        ));

        // Zoom in + fade out ──────────────────────────── t ≈ 2130ms
        containerOp.value = withDelay(2130,
            withTiming(0, { duration: 380 }, (done) => {
                if (done) runOnJS(onFinished)();
            }),
        );
        containerSc.value = withDelay(2130,
            withTiming(1.18, { duration: 380, easing: Easing.in(Easing.cubic) }),
        );
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [
            { translateY: logoY.value },
            { scale: logoScale.value },
            { rotate: `${logoRotate.value}deg` },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: glowScale.value }],
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOp.value,
        transform: [{ scale: containerSc.value }],
    }));

    const flashStyle = useAnimatedStyle(() => ({
        opacity: flashOp.value,
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]}>

            {/* Sonar rings */}
            <Ring delay={0} />
            <Ring delay={170} />
            <Ring delay={340} />

            {/* Radial glow behind logo */}
            <Animated.View style={[styles.glow, glowStyle]} />

            {/* Starburst particles */}
            <Animated.View style={styles.particleAnchor}>
                {PARTICLES.map((p, i) => (
                    <Particle key={i} {...p} delay={1010 + i * 28} />
                ))}
            </Animated.View>

            {/* Logo */}
            <Animated.View style={logoStyle}>
                <Image
                    source={require('../assets/images/splash-icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* Exit flash */}
            <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0B9600',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    ring: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    glow: {
        position: 'absolute',
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        borderRadius: LOGO_SIZE / 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    particleAnchor: {
        position: 'absolute',
        width: 0,
        height: 0,
    },
    particle: {
        position: 'absolute',
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
    flash: {
        backgroundColor: '#ffffff',
    },
});