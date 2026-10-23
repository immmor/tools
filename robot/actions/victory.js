window.RobotActions = window.RobotActions || {};
(function () {
    // VICTORY: dynamic leap with a full 360° spin and both arms thrown into a V
    window.RobotActions.victory = {
        duration: 1.3,
        dynamic: true,
        update(ctx) {
            const { t, bones, setJumpOffset, smooth01 } = ctx;
            const { pelvisGroup, leftArm, rightArm, leftLeg, rightLeg, headGroup, torsoGroup } = bones;
            const ramp = (a, b) => smooth01((t - a) / (b - a));
            const CROUCH = 0.16, LAND = 0.82;
            const DIP = 0.35, PEAK = 1.4;

            let yOff;
            if (t < CROUCH) yOff = -DIP * ramp(0, CROUCH);
            else if (t < LAND) {
                const s = (t - CROUCH) / (LAND - CROUCH);
                yOff = (PEAK + DIP) * 4 * s * (1 - s) - DIP;
            } else yOff = -DIP * (1 - ramp(LAND, 1.0));
            setJumpOffset(yOff);

            // full-body 360 spin about vertical
            pelvisGroup.rotation.y = t * Math.PI * 2;
            pelvisGroup.rotation.z = 0;

            // V-arms: both shoulders up & out, elbows bent
            const up = 0.65 + ramp(CROUCH, 0.5) * 0.35;
            leftArm.shoulderPivot.rotation.x = -2.5 * up;
            leftArm.shoulderPivot.rotation.z = 0.7;
            leftArm.elbowPivot.rotation.x = -0.7;
            rightArm.shoulderPivot.rotation.x = -2.5 * up;
            rightArm.shoulderPivot.rotation.z = -0.7;
            rightArm.elbowPivot.rotation.x = -0.7;

            // legs: tuck in flight, extend on land
            const tuck = ramp(CROUCH, 0.5) * (1 - ramp(0.6, LAND));
            const land = ramp(LAND, 1.0);
            const knee = (1 - tuck) * 0.2 + land * 0.6;
            const hip = -0.15 - tuck * 0.5 + land * 0.2;
            [leftLeg, rightLeg].forEach(l => {
                l.hipPivot.rotation.x = hip;
                l.kneePivot.rotation.x = knee * 1.6;
                l.footPivot.rotation.x = l.hipPivot.rotation.x * 0.9 - l.kneePivot.rotation.x * 1.5;
            });

            torsoGroup.rotation.x = -0.1 * up;
            headGroup.rotation.x = 0.1 * up;
        }
    };
})();
