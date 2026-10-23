// Robot model: SECOND humanoid biped ("teal" variant).
// Self-contained file registering under 'humanoid2'. Reuses the exact same
// bone structure (pelvis/torso/head/arms/legs) as the default humanoid so all
// registered actions (jump, kick, cheer, victory, ...) work unchanged.
// Returns { type:'humanoid', group, radius, pelvisGroup, torsoGroup, headGroup,
//           leftArm, rightArm, leftLeg, rightLeg }
window.RobotModels = window.RobotModels || {};

window.RobotModels.humanoid2 = function (THREE) {
    const SCALE = 1.12;                 // a touch taller/slimmer than the default
    const robotGroup = new THREE.Group();
    robotGroup.scale.setScalar(SCALE);
    const robotRadius = 0.9 * SCALE;

    // distinct teal/cyan look
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x1b6ca8, roughness: 0.3, metalness: 0.7 });
    const darkJointMat = new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.5, metalness: 0.6 });
    const visorGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.y = 2.0;
    robotGroup.add(pelvisGroup);
    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5), armorMat);
    pelvisMesh.castShadow = true;
    pelvisGroup.add(pelvisMesh);

    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.25;
    pelvisGroup.add(torsoGroup);
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.92, 0.55), armorMat);
    chestMesh.position.y = 0.46;
    chestMesh.castShadow = true;
    torsoGroup.add(chestMesh);
    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.57), visorGlowMat);
    chestStripe.position.set(0, 0.46, 0);
    torsoGroup.add(chestStripe);

    const headGroup = new THREE.Group();
    headGroup.position.y = 1.06;
    torsoGroup.add(headGroup);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.46), armorMat);
    headMesh.position.y = 0.22;
    headMesh.castShadow = true;
    headGroup.add(headMesh);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), visorGlowMat);
    visorMesh.position.set(0, 0.26, 0.21);
    headGroup.add(visorMesh);

    function createArm(isLeft) {
        const side = isLeft ? 1 : -1;
        const shoulderPivot = new THREE.Group();
        shoulderPivot.position.set(side * 0.54, 0.82, 0);
        shoulderPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), darkJointMat));
        const upperArm = new THREE.Group();
        shoulderPivot.add(upperArm);
        const upperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.65, 16), armorMat);
        upperArmMesh.position.y = -0.325;
        upperArmMesh.castShadow = true;
        upperArm.add(upperArmMesh);
        const elbowPivot = new THREE.Group();
        elbowPivot.position.y = -0.65;
        upperArm.add(elbowPivot);
        elbowPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), darkJointMat));
        const lowerArm = new THREE.Group();
        elbowPivot.add(lowerArm);
        const lowerArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 16), armorMat);
        lowerArmMesh.position.y = -0.3;
        lowerArmMesh.castShadow = true;
        lowerArm.add(lowerArmMesh);
        const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.15), darkJointMat);
        handMesh.position.y = -0.65;
        lowerArm.add(handMesh);
        torsoGroup.add(shoulderPivot);
        return { shoulderPivot, upperArm, elbowPivot, lowerArm };
    }
    const leftArm = createArm(true);
    const rightArm = createArm(false);

    function createLeg(isLeft) {
        const side = isLeft ? 1 : -1;
        const hipPivot = new THREE.Group();
        hipPivot.position.set(side * 0.25, -0.15, 0);
        hipPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), darkJointMat));
        const upperLeg = new THREE.Group();
        hipPivot.add(upperLeg);
        const upperLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 16), armorMat);
        upperLegMesh.position.y = -0.425;
        upperLegMesh.castShadow = true;
        upperLeg.add(upperLegMesh);
        const kneePivot = new THREE.Group();
        kneePivot.position.y = -0.85;
        upperLeg.add(kneePivot);
        kneePivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), darkJointMat));
        const lowerLeg = new THREE.Group();
        kneePivot.add(lowerLeg);
        const lowerLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 16), armorMat);
        lowerLegMesh.position.y = -0.425;
        lowerLegMesh.castShadow = true;
        lowerLeg.add(lowerLegMesh);
        const footPivot = new THREE.Group();
        footPivot.position.y = -0.85;
        lowerLeg.add(footPivot);
        const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.45), darkJointMat);
        footMesh.position.set(0, -0.06, 0.1);
        footMesh.castShadow = true;
        footPivot.add(footMesh);
        pelvisGroup.add(hipPivot);
        return { hipPivot, upperLeg, kneePivot, lowerLeg, footPivot };
    }
    const leftLeg = createLeg(true);
    const rightLeg = createLeg(false);

    return {
        type: 'humanoid',
        group: robotGroup,
        radius: robotRadius,
        pelvisGroup, torsoGroup, headGroup,
        leftArm, rightArm, leftLeg, rightLeg
    };
};
