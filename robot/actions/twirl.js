window.RobotActions = window.RobotActions || {};
(function () {
    // TWIRL: ground spin with arms outstretched + hip sway (no lift)
    window.RobotActions.twirl = {
        duration: 1.4,
        dynamic: false,
        update(ctx) {
            const { t, bones } = ctx;
            const { pelvisGroup, leftArm, rightArm, leftLeg, rightLeg, headGroup, torsoGroup } = bones;
            const s = Math.sin(t * Math.PI * 6);

            pelvisGroup.rotation.y = t * Math.PI * 2;
            pelvisGroup.rotation.z = s * 0.08;
            pelvisGroup.position.y = 2.0 + Math.abs(s) * 0.06;

            // arms out like an airplane
            leftArm.shoulderPivot.rotation.z = 1.5;
            leftArm.shoulderPivot.rotation.x = 0.1;
            leftArm.elbowPivot.rotation.x = -0.2;
            rightArm.shoulderPivot.rotation.z = -1.5;
            rightArm.shoulderPivot.rotation.x = 0.1;
            rightArm.elbowPivot.rotation.x = -0.2;

            // legs straight with a slight weight shift
            const shift = s * 0.12;
            leftLeg.hipPivot.rotation.x = shift;
            rightLeg.hipPivot.rotation.x = -shift;
            leftLeg.kneePivot.rotation.x = 0.1;
            rightLeg.kneePivot.rotation.x = 0.1;
            leftLeg.footPivot.rotation.x = leftLeg.hipPivot.rotation.x * 0.9 - leftLeg.kneePivot.rotation.x * 1.5;
            rightLeg.footPivot.rotation.x = rightLeg.hipPivot.rotation.x * 0.9 - rightLeg.kneePivot.rotation.x * 1.5;

            headGroup.rotation.y = s * 0.2;
            torsoGroup.rotation.y = s * 0.1;
        }
    };
})();
