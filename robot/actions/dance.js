window.RobotActions = window.RobotActions || {};
(function () {
    // DANCE: rhythmic full-body groove — hip sway, torso twist, alternating arm pumps, head bob
    window.RobotActions.dance = {
        duration: 2.4,
        dynamic: false,
        update(ctx) {
            const { t, bones } = ctx;
            const { pelvisGroup, leftArm, rightArm, leftLeg, rightLeg, headGroup, torsoGroup } = bones;
            const beat = t * Math.PI * 8; // ~4 beats over the move
            const s = Math.sin(beat);

            pelvisGroup.position.y = 2.0 + Math.abs(s) * 0.12; // bounce
            pelvisGroup.rotation.z = s * 0.12;                   // hip sway
            pelvisGroup.rotation.y = 0;

            torsoGroup.rotation.y = s * 0.22;                    // twist
            torsoGroup.rotation.x = 0;

            headGroup.rotation.x = Math.sin(beat * 1.5) * 0.12;
            headGroup.rotation.z = s * 0.1;

            // alternating arm pumps
            const lPump = Math.max(0, s);
            const rPump = Math.max(0, -s);
            leftArm.shoulderPivot.rotation.x = -0.2 - lPump * 1.1;
            leftArm.elbowPivot.rotation.x = -0.7 - lPump * 0.3;
            leftArm.shoulderPivot.rotation.z = 0.15;
            rightArm.shoulderPivot.rotation.x = -0.2 - rPump * 1.1;
            rightArm.elbowPivot.rotation.x = -0.7 - rPump * 0.3;
            rightArm.shoulderPivot.rotation.z = -0.15;

            // weight-shift legs
            const ws = s * 0.18;
            leftLeg.hipPivot.rotation.x = ws;
            rightLeg.hipPivot.rotation.x = -ws;
            leftLeg.kneePivot.rotation.x = 0.15 + Math.max(0, ws) * 0.6;
            rightLeg.kneePivot.rotation.x = 0.15 + Math.max(0, -ws) * 0.6;
            leftLeg.footPivot.rotation.x = leftLeg.hipPivot.rotation.x * 0.9 - leftLeg.kneePivot.rotation.x * 1.5;
            rightLeg.footPivot.rotation.x = rightLeg.hipPivot.rotation.x * 0.9 - rightLeg.kneePivot.rotation.x * 1.5;
        }
    };
})();
